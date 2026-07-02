"""
load_hongkong_pv.py — Explore the Hong Kong rooftop PV dataset for Awan-Cast.

WHAT THIS DOES
  After you download Dataset.zip from Dryad and unzip it into this data/ folder,
  this script scans what's inside, prints the file tree, and loads a sample file
  so you can see the columns and structure before writing pipeline code.

BEFORE YOU RUN
  1. Download from: https://datadryad.org/dataset/doi:10.5061/dryad.m37pvmd99
     (click Download -> Download dataset; ~296 MB; needs a browser, anti-bot wall)
  2. Save Dataset.zip into this data/ folder and unzip it here.
  3. pip install pandas
  4. python load_hongkong_pv.py

WHY THIS DATASET
  60 grid-connected rooftop PV stations, Hong Kong, 2021-2023.
  PV power at 5-min inverter-level + on-site weather at 1-min.
  Used to build and tune the Awan-Cast Layer 3 appliance scheduler with
  REAL rooftop generation behaviour. Caveat for documentation: Hong Kong,
  not Malaysia -- a defensible humid/convective tropical-ish proxy.
"""

import os
import sys
import zipfile

HERE = os.path.dirname(__file__)


def find_dataset_root():
    """Locate the unzipped dataset folder, or offer to unzip Dataset.zip."""
    for cand in ("Dataset", "dataset", "Dataset.zip"):
        p = os.path.join(HERE, cand)
        if os.path.isdir(p):
            return p
        if os.path.isfile(p) and p.endswith(".zip"):
            print(f"Found {cand} (not yet unzipped). Unzipping...")
            with zipfile.ZipFile(p) as z:
                z.extractall(HERE)
            print("Unzipped.")
            inner = os.path.join(HERE, "Dataset")
            return inner if os.path.isdir(inner) else HERE
    return None


def print_tree(root, max_entries=40):
    print(f"\nFile tree under {root}:")
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        depth = dirpath.replace(root, "").count(os.sep)
        indent = "  " * depth
        print(f"{indent}{os.path.basename(dirpath) or root}/")
        for fn in sorted(filenames):
            size = os.path.getsize(os.path.join(dirpath, fn))
            print(f"{indent}  {fn}  ({size//1024} KB)")
            count += 1
            if count >= max_entries:
                print(f"{indent}  ... (truncated, {count}+ files)")
                return


def sample_first_csv(root):
    """Load the first CSV found and show its structure."""
    try:
        import pandas as pd
    except ImportError:
        print("\n(pandas not installed -- run: pip install pandas -- to preview data)")
        return
    for dirpath, _, filenames in os.walk(root):
        for fn in sorted(filenames):
            if fn.lower().endswith((".csv", ".txt")):
                path = os.path.join(dirpath, fn)
                print(f"\nSample file: {path}")
                try:
                    df = pd.read_csv(path, nrows=2000)
                except Exception as e:
                    print(f"  could not parse as CSV: {e}")
                    return
                print(f"  shape (first 2000 rows): {df.shape}")
                print(f"  columns: {df.columns.tolist()}")
                print("  head:")
                print(df.head(5).to_string(max_cols=12))
                return
    print("\nNo CSV/TXT files found to sample.")


def main():
    root = find_dataset_root()
    if root is None:
        print("Dataset not found in this folder.")
        print("Download Dataset.zip from:")
        print("  https://datadryad.org/dataset/doi:10.5061/dryad.m37pvmd99")
        print("Save it into this data/ folder, then run this script again.")
        sys.exit(1)
    print_tree(root)
    sample_first_csv(root)
    print("\nNext steps for the build:")
    print("  - identify the PV-power columns and the weather columns")
    print("  - resample PV to a common cadence, align with weather timestamps")
    print("  - use this as the 'real rooftop' input when developing Layer 3")


if __name__ == "__main__":
    main()
