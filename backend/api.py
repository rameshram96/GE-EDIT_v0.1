"""GE-EDIT API: thin, stateless wrapper over the existing modules/ package.
Copy your existing `modules/` folder into backend/ next to this file.
Run: uvicorn api:app --reload --port 8000"""
import os, sys, json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modules.sequence_parser import parse_sequence, detect_format, parse_pasted_sequence
from modules.primer_design import (design_all_primers, MIN_AMPLICON,
                                   MIN_PRIMER_LEN, MAX_PRIMER_LEN)
from modules.project_file import (assign_ids, primers_to_order_csv_bytes,
                                  primers_to_excel_bytes, primers_to_summary_excel_bytes)
from modules.genbank_export import build_annotated_genbank_bytes
from modules.primer_design import redesign_primers, redesign_wrap_amplicon
from modules.control_primers import controls_from_rows, rows_from_upload
from modules.report_data import build_report_data
import base64

app = FastAPI(title="GE-EDIT API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

class ParseIn(BaseModel):
    text: str
    filename: str | None = None   # set for uploaded files, omit for pasted text
    name: str = "Pasted_Sequence"

class DesignIn(BaseModel):
    sequence: str
    max_amp: int = 500
    min_over: int = 50
    opt_tm: float = 60.0
    min_tm: float = 58.0
    max_tm: float = 62.0

class ExportIn(BaseModel):
    primers: list
    project_name: str = "project"
    seq_info: dict | None = None

@app.post("/api/parse")
def parse(d: ParseIn):
    try:
        if d.filename:
            return parse_sequence(d.text, detect_format(d.filename))
        return parse_pasted_sequence(d.text, d.name)
    except ValueError as e:
        raise HTTPException(400, str(e))

@app.post("/api/design")
def design(d: DesignIn):
    params = {'PRIMER_OPT_SIZE': 20, 'PRIMER_MIN_SIZE': 18, 'PRIMER_MAX_SIZE': 25,
              'PRIMER_OPT_TM': d.opt_tm, 'PRIMER_MIN_TM': d.min_tm, 'PRIMER_MAX_TM': d.max_tm,
              'PRIMER_MIN_GC': 40.0, 'PRIMER_MAX_GC': 60.0, 'PRIMER_MAX_POLY_X': 4,
              'PRIMER_SALT_MONOVALENT': 50.0, 'PRIMER_DNA_CONC': 50.0, 'PRIMER_NUM_RETURN': 5,
              'PRIMER_MAX_SELF_ANY': 12, 'PRIMER_MAX_SELF_END': 8,
              'PRIMER_PAIR_MAX_COMPL_ANY': 12, 'PRIMER_PAIR_MAX_COMPL_END': 8}
    primers, violations = design_all_primers(d.sequence.upper(), d.max_amp, d.min_over, params)
    assign_ids(primers)
    design_params = {'max_amplicon': d.max_amp, 'min_overlap': d.min_over, 'opt_tm': d.opt_tm,
                     'min_tm': d.min_tm, 'max_tm': d.max_tm, 'min_gc': 40.0, 'max_gc': 60.0,
                     'primer_len_min': MIN_PRIMER_LEN, 'primer_len_max': MAX_PRIMER_LEN,
                     'min_amplicon': MIN_AMPLICON, 'salt_monovalent': 50.0, 'dna_conc': 50.0,
                     'designed_at': datetime.now().strftime('%Y-%m-%d %H:%M')}
    return {"primers": primers, "violations": violations, "design_params": design_params}

@app.post("/api/export/order-csv")
def order_csv(d: ExportIn):
    return Response(primers_to_order_csv_bytes(d.primers).getvalue(), media_type="text/csv")

@app.post("/api/export/excel")
def excel(d: ExportIn):
    return Response(primers_to_excel_bytes(d.primers, d.project_name).getvalue(), media_type=XLSX)

@app.post("/api/export/summary-excel")
def summary_excel(d: ExportIn):
    return Response(primers_to_summary_excel_bytes(d.primers, d.project_name).getvalue(), media_type=XLSX)

@app.post("/api/export/genbank")
def genbank(d: ExportIn):
    if not d.seq_info:
        raise HTTPException(400, "seq_info required")
    return Response(build_annotated_genbank_bytes(d.seq_info, d.primers, d.project_name),
                    media_type="chemical/seq-na-genbank")

# Visitor counter: stores a single integer, no visitor data.
COUNTER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "visits.json")
@app.post("/api/visit")
def visit():
    try: n = json.load(open(COUNTER))["total"]
    except Exception: n = 0
    n += 1
    json.dump({"total": n}, open(COUNTER, "w"))
    return {"total_visits": n}

class RedesignIn(BaseModel):
    sequence: str
    primer: dict
    best: list
    ext_l: int = 100
    ext_r: int = 100
    fp_shift: int = 0
    min_overlap: int = 50

@app.post("/api/redesign")
def redesign(d: RedesignIn):
    p, best = d.primer, d.best
    idx = next((i for i, x in enumerate(best) if x['amplicon_num'] == p['amplicon_num']), None)
    prev_end = best[idx - 1]['amplicon_end'] if idx else None
    next_start = best[idx + 1]['amplicon_start'] if idx is not None and idx < len(best) - 1 else None
    if p.get('wraps_origin'):
        valid = [x for x in best if x['fp_sequence'] != 'DESIGN_FAILED']
        r, err = redesign_wrap_amplicon(d.sequence, p, valid[0], d.min_overlap, fp_shift=d.fp_shift,
                                        ext_right=d.ext_r, old_version=p.get('version', 1), prev_amp_end=prev_end)
        return {"results": [r] if r else None, "is_split": False, "error": err}
    r, err, split = redesign_primers(d.sequence, p['amplicon_start'], p['amplicon_end'], p['amplicon_num'],
                                     d.ext_l, d.ext_r, p.get('version', 1),
                                     prev_amp_end=prev_end, next_amp_start=next_start)
    return {"results": (r if split else [r]) if r else None, "is_split": split, "error": err}

class ControlsIn(BaseModel):
    rows: list
    existing: list = []

@app.post("/api/controls")
def controls(d: ControlsIn):
    c, errors, warnings = controls_from_rows(d.rows, d.existing)
    return {"controls": c, "errors": errors, "warnings": warnings}

class ImportIn(BaseModel):
    content: str   # base64
    filename: str

@app.post("/api/controls/import")
def controls_import(d: ImportIn):
    try:
        return {"rows": rows_from_upload(base64.b64decode(d.content), d.filename)}
    except Exception as e:
        raise HTTPException(400, str(e))

class ReportIn(BaseModel):
    project: dict
    seq_info: dict | None = None
    options: dict = {}

@app.post("/api/report/{fmt}")
def report(fmt: str, d: ReportIn):
    rd = build_report_data(d.project, seq_info=d.seq_info, options=d.options)
    if fmt == "word":
        from modules.word_report import build_word_report
        buf, st = build_word_report(rd, return_status=True)
        st = st or {}
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hdr = {"X-Comments": str(st.get("comments", 0)), "X-Skipped": st.get("comments_skipped_reason") or "",
               "X-Mismatches": ",".join(st.get("mismatches", []))}
    else:
        from modules.pdf_report import build_pdf_report
        buf, st = build_pdf_report(rd, return_status=True)
        mime = "application/pdf"
        hdr = {"X-Comments": "0", "X-Skipped": "", "X-Mismatches": ",".join(st.get("mismatches", []))}
    return Response(buf.getvalue(), media_type=mime, headers=hdr)
