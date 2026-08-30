import os
import re
import pandas as pd
import sys

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"Base Directory: {base_dir}")
    
    # 1. Scan for subfolders matching YY-MM pattern
    folder_pattern = re.compile(r'^\d{2}-\d{2}$')
    subfolders = sorted([
        f for f in os.listdir(base_dir) 
        if os.path.isdir(os.path.join(base_dir, f)) and folder_pattern.match(f)
    ])
    
    print(f"Found {len(subfolders)} monthly folders.")
    
    # 2. Read and combine all CSV files
    all_dfs = []
    for folder in subfolders:
        folder_path = os.path.join(base_dir, folder)
        files = os.listdir(folder_path)
        csv_files = [f for f in files if f.lower().endswith('.csv')]
        
        if not csv_files:
            print(f"[Skip] No CSV file found in {folder}.")
            continue
            
        csv_path = os.path.join(folder_path, csv_files[0])
        print(f"Reading: {folder}/{csv_files[0]}")
        
        try:
            df = pd.read_csv(csv_path)
            # Create standard YYYY-MM column from YY-MM folder name (e.g. 21-01 -> 2021-01)
            edition_val = f"20{folder[:2]}-{folder[3:]}"
            df['edition'] = edition_val
            
            # Put 'edition' as the first column in the monthly CSV
            cols = ['edition'] + [c for c in df.columns if c != 'edition']
            df = df[cols]
            
            # Save the updated individual CSV file
            df.to_csv(csv_path, index=False)
            print(f"Updated individual CSV: {folder}/{csv_files[0]}")
            
            all_dfs.append(df)
        except Exception as e:
            print(f"[Error] Failed to process {csv_path}: {e}")
            
    if not all_dfs:
        print("Error: No CSV data was loaded. Exiting.")
        return
        
    print("\nCombining all monthly CSV files...")
    combined_df = pd.concat(all_dfs, ignore_index=True)
    
    # Sort first by project name, then by edition chronologically
    combined_df = combined_df.sort_values(by=['project name', 'edition'], ascending=[True, True])
    
    # Reorder columns to put 'edition' as the first column
    cols = ['edition'] + [c for c in combined_df.columns if c != 'edition']
    combined_df = combined_df[cols]
    
    # 4. Save the combined CSV
    output_path = os.path.join(base_dir, "combined_projects.csv")
    try:
        combined_df.to_csv(output_path, index=False)
        print(f"\nSUCCESS! Combined CSV saved to: {output_path}")
    except PermissionError:
        fallback_path = os.path.join(base_dir, "combined_projects_new.csv")
        print(f"\n[Warning] Permission denied! The file '{output_path}' is open in Excel or another program.")
        print(f"Saving to fallback file: {fallback_path}")
        combined_df.to_csv(fallback_path, index=False)
        print(f"SUCCESS! Combined CSV saved to fallback: {fallback_path}")
    print(f"Total CSVs combined: {len(all_dfs)}")
    print(f"Total row count: {len(combined_df)}")
    print(f"Unique projects: {combined_df['project name'].nunique()}")

if __name__ == "__main__":
    main()
