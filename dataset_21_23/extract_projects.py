import pdfplumber
import re
import csv
import sys
import os
import argparse

# Words/lines to ignore (watermarks, page headers, etc. that can overlap cell boundaries)
IGNORE_LINES = {
    "fla", "s", "h re", "po", "rt", "flash", "report", "flash report",
    "detail of ongoing projects costing rs", "detail of ongoing projects",
    "crore and above.", "all cost/ expenditure in rs. crore",
    "original / revised cost", "anticipated cost", "cumulative expenditure",
    "date of commissioning", "delay w.r.t. original/ revised", "miles tones achieved/ total",
    "original / revised / anticipated", "original (revised) [anticipated]",
    "cumulative expenditure in rs. crore", "(all cost/ expenditure in rs. crore)",
    "original", "revised", "anticipated", "cost", "expenditure", "milestones", "total",
    "si.no", "project", "date of approval", "date of approval (month / year)",
    "original / revised / anticipated date of commissioning", "original (revised) [anticipated] cost",
    "cumulative expenditure in rs. crore (cost overrun in rs. crore) [time overrun in months ]",
    "miles tones achieved / total"
}

def should_ignore_line(line):
    line_clean = line.strip().lower()
    if not line_clean:
        return True
    if line_clean in IGNORE_LINES:
        return True
    if re.match(r'^page\s+\d+$', line_clean):
        return True
    return False

def clean_lines(text):
    if not text:
        return []
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        if not should_ignore_line(line):
            cleaned.append(line.strip())
    return cleaned

def parse_project_column(text_lines):
    text = " ".join(text_lines).strip()
    if not text:
        return "", "", "", ""
    # Extract project code: text within square brackets [...]
    code_match = re.search(r'\[([^\]]+)\]', text)
    if code_match:
        project_code = code_match.group(1).strip()
        name_part = text[:code_match.start()].strip()
        # Clean trailing dash/spaces in name
        project_name = re.sub(r'\s*-\s*$', '', name_part).strip()
        project_name = re.sub(r'\s+', ' ', project_name)
        
        rest = text[code_match.end():].strip()
        parts = [p.strip() for p in rest.split(',') if p.strip()]
        agency = ""
        state = ""
        if len(parts) >= 1:
            agency = parts[0]
        if len(parts) >= 2:
            state = parts[1]
            state = re.sub(r'\s+', ' ', state).strip()
            state = re.sub(r'\s*,$', '', state)
        return project_name, agency, project_code, state
    else:
        name = re.sub(r'\s+', ' ', text).strip()
        return name, "", "", ""

def clean_val(val):
    if not val:
        return ""
    val = val.strip()
    if val.startswith('(') and val.endswith(')'):
        val = val[1:-1].strip()
    if val.startswith('[') and val.endswith(']'):
        val = val[1:-1].strip()
    return val

def clean_table_rows(table):
    if not table:
        return []
    proj_rows = [row for row in table if len(row) > 1 and row[0] and row[0].strip().isdigit()]
    if not proj_rows:
        return table
        
    num_cols = len(table[0])
    active_cols = []
    for col_idx in range(num_cols):
        is_empty = True
        for row in proj_rows:
            val = row[col_idx]
            if val is not None and str(val).strip() != "":
                is_empty = False
                break
        if not is_empty:
            active_cols.append(col_idx)
            
    cleaned_table = []
    for row in table:
        cleaned_row = [row[idx] for idx in active_cols]
        cleaned_table.append(cleaned_row)
    return cleaned_table

def parse_cleaned_row(row, num_cols):
    if num_cols == 10:
        # Layout A: 10 columns standard
        sno = clean_val(row[0])
        project_lines = clean_lines(row[1])
        doa_lines = clean_lines(row[2])
        doa = doa_lines[0] if doa_lines else ""
        
        cost_parts = [clean_val(p) for p in clean_lines(row[3])]
        orig_cost = cost_parts[0] if len(cost_parts) > 0 else ""
        rev_cost = cost_parts[1] if len(cost_parts) > 1 else "-"
        
        cum_exp_lines = clean_lines(row[5])
        cum_exp = cum_exp_lines[0] if cum_exp_lines else ""
        
        doc_parts = [clean_val(p) for p in clean_lines(row[6])]
        orig_doc = doc_parts[0] if len(doc_parts) > 0 else ""
        rev_doc = doc_parts[1] if len(doc_parts) > 1 else "-"
        
        phys_prog_lines = clean_lines(row[9])
        phys_prog = phys_prog_lines[0] if phys_prog_lines else ""
    elif num_cols == 7:
        # Layout B: 7 columns dense
        sno = clean_val(row[0])
        project_lines = clean_lines(row[1])
        doa_lines = clean_lines(row[2])
        doa = doa_lines[0] if doa_lines else ""
        
        doc_parts = [clean_val(p) for p in clean_lines(row[3])]
        orig_doc = doc_parts[0] if len(doc_parts) > 0 else ""
        rev_doc = doc_parts[1] if len(doc_parts) > 1 else "-"
        
        cost_parts = [clean_val(p) for p in clean_lines(row[4])]
        orig_cost = cost_parts[0] if len(cost_parts) > 0 else ""
        rev_cost = cost_parts[1] if len(cost_parts) > 1 else "-"
        
        exp_parts = [clean_val(p) for p in clean_lines(row[5])]
        cum_exp = exp_parts[0] if len(exp_parts) > 0 else ""
        
        phys_prog_lines = clean_lines(row[6])
        phys_prog = phys_prog_lines[0] if phys_prog_lines else ""
    else:
        return None
        
    proj_name, agency, proj_code, state = parse_project_column(project_lines)
    
    return {
        "sno": sno,
        "project name": proj_name,
        "agency": agency,
        "project code": proj_code,
        "state": state,
        "doa": doa,
        "original/target doc": orig_doc,
        "revised doc": rev_doc,
        "original cost": orig_cost,
        "revised cost": rev_cost,
        "cumulative expenditure": cum_exp,
        "physical progress": phys_prog
    }

def merge_and_parse_table_rows(all_cleaned_rows):
    processed_rows = []
    current_row = None
    
    for row, num_cols in all_cleaned_rows:
        sno = row[0]
        if sno and sno.strip().isdigit():
            sno_val = int(sno.strip())
            # Skip numbering headers e.g., '1', '2', '3'
            if sno_val == 1 and len(row) > 1 and row[1] == '2':
                continue
            
            if current_row:
                parsed = parse_cleaned_row(current_row['row'], current_row['num_cols'])
                if parsed:
                    processed_rows.append(parsed)
            
            current_row = {
                'row': list(row),
                'num_cols': num_cols
            }
        else:
            if current_row and len(row) > 1 and row[1] and row[1].strip():
                # Merge if the current row doesn't already have a project code [CODE]
                current_project_text = current_row['row'][1] or ""
                has_code = '[' in current_project_text and ']' in current_project_text
                
                if not has_code:
                    current_row['row'][1] = current_project_text + "\n" + row[1]
                    for c_idx in range(2, min(len(row), len(current_row['row']))):
                        if row[c_idx] and row[c_idx].strip():
                            curr_val = current_row['row'][c_idx]
                            if not curr_val or curr_val.strip() in ("", "-"):
                                current_row['row'][c_idx] = row[c_idx]
                            
    if current_row:
        parsed = parse_cleaned_row(current_row['row'], current_row['num_cols'])
        if parsed:
            processed_rows.append(parsed)
            
    return processed_rows

def get_edition_from_path(pdf_path):
    # Try parent directory name first (e.g., YY-MM)
    parent_dir = os.path.basename(os.path.dirname(pdf_path))
    if re.match(r'^\d{2}-\d{2}$', parent_dir):
        return f"20{parent_dir[:2]}-{parent_dir[3:]}"
        
    # Fallback to parsing filename
    filename = os.path.basename(pdf_path).lower()
    year_match = re.search(r'\b(20\d{2})\b', filename)
    if not year_match:
        year_match = re.search(r'20\d{2}', filename)
        
    months = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    }
    month_val = "01"
    for name, val in months.items():
        if name in filename:
            month_val = val
            break
            
    if year_match:
        return f"{year_match.group(0)}-{month_val}"
    
    return "Unknown"

def extract_ongoing_projects(pdf_path, output_csv_path):
    if not os.path.exists(pdf_path):
        print(f"Error: Input PDF file not found at: {pdf_path}")
        return False
        
    print(f"Reading PDF: {pdf_path}")
    doc = pdfplumber.open(pdf_path)
    found_pages = []
    
    for idx, page in enumerate(doc.pages):
        text = page.extract_text() or ""
        if "Detail of ongoing Projects Costing" in text:
            found_pages.append(idx + 1)
            
    if not found_pages:
        print("Error: Could not find 'Detail of ongoing Projects Costing' table header in the PDF.")
        doc.close()
        return False
        
    start_page = min(found_pages)
    print(f"Detected start page of ongoing projects table: Page {start_page}")
    
    all_cleaned_rows = []
    curr_page_num = start_page
    
    while curr_page_num <= len(doc.pages):
        page = doc.pages[curr_page_num - 1]
        # Crop page vertically to remove standard header and footer blocks
        cropped_page = page.crop((0, 73, page.width, 740))
        tables = cropped_page.extract_tables()
        
        has_numeric_sno = False
        page_rows = []
        for table in tables:
            cleaned = clean_table_rows(table)
            if not cleaned or not cleaned[0]:
                continue
            num_cols = len(cleaned[0])
            if num_cols == 0:
                continue
            for row in cleaned:
                if len(row) < num_cols:
                    continue
                sno = row[0]
                if sno and sno.strip().isdigit():
                    sno_val = int(sno.strip())
                    if sno_val == 1 and row[1] == '2':
                        continue
                    has_numeric_sno = True
                page_rows.append((row, num_cols))
                
        # Stop scanning if this page doesn't have any numeric SNo entries
        if not has_numeric_sno and curr_page_num > start_page:
            print(f"Stopping scan at Page {curr_page_num} (end of ongoing projects table reached).")
            break
            
        all_cleaned_rows.extend(page_rows)
        curr_page_num += 1
        
    doc.close()
    
    print(f"Total raw table rows collected: {len(all_cleaned_rows)}")
    parsed_projects = merge_and_parse_table_rows(all_cleaned_rows)
    print(f"Total projects successfully parsed: {len(parsed_projects)}")
    
    edition_val = get_edition_from_path(pdf_path)
    
    columns = [
        "edition", "project name", "agency", "project code", "state", "doa",
        "original/target doc", "revised doc", "original cost", "revised cost",
        "cumulative expenditure", "physical progress"
    ]
    
    with open(output_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for proj in parsed_projects:
            proj["edition"] = edition_val
            row_dict = {col: proj.get(col, "") for col in columns}
            writer.writerow(row_dict)
            
    print(f"Extraction complete. CSV saved to: {output_csv_path}")
    return True

if __name__ == "__main__":
    pdf_path = None
    output_csv = None
    
    if len(sys.argv) > 1:
        parser = argparse.ArgumentParser(description="Extract ongoing project tables from MoSPI Flash Report PDFs.")
        parser.add_argument("pdf_path", help="Path to the input Flash Report PDF file.")
        parser.add_argument("--output", "-o", help="Optional path to output CSV. Defaults to same directory and filename as PDF.")
        
        args = parser.parse_args()
        pdf_path = args.pdf_path
        output_csv = args.output
    else:
        # Prompt the user with a GUI file picker (Tkinter) or text input fallback
        print("No arguments provided. Launching PDF selector...")
        try:
            import tkinter as tk
            from tkinter import filedialog
            
            root = tk.Tk()
            root.withdraw()  # Hide main window
            root.lift()
            root.attributes("-topmost", True)
            
            selected_file = filedialog.askopenfilename(
                title="Select MoSPI Flash Report PDF",
                filetypes=[("PDF Files", "*.pdf"), ("All Files", "*.*")]
            )
            root.destroy()
            
            if selected_file:
                pdf_path = selected_file
                print(f"Selected file: {pdf_path}")
        except Exception as e:
            print(f"Could not open file dialog: {e}")
            
        if not pdf_path:
            # Fallback to CLI input
            pdf_path = input("Please enter the path to the PDF file: ").strip()
            # Remove bounding quotes if dragged and dropped
            if (pdf_path.startswith('"') and pdf_path.endswith('"')) or (pdf_path.startswith("'") and pdf_path.endswith("'")):
                pdf_path = pdf_path[1:-1].strip()
                
        if not pdf_path or not os.path.exists(pdf_path):
            print("Invalid or empty path. Exiting.")
            sys.exit(1)
            
    if not output_csv:
        # Create CSV filename matching PDF filename (in the same directory)
        base, _ = os.path.splitext(pdf_path)
        output_csv = base + ".csv"
        
    extract_ongoing_projects(pdf_path, output_csv)
