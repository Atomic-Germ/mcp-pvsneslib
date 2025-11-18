#!/bin/bash
# TCC wrapper to fix FEX parameter parsing issues

# Original TCC path
TCC_ORIG="/home/caseyjparker/.pvsneslib/pvsneslib-4.3.0/devkitsnes/bin/816-tcc"

# Handle multiple source files with -c flag by invoking tcc separately for each file
if [[ "$*" == *"-c"* ]]; then
  # Extract -c flag and output file
  args=("$@")
  output_file=""
  source_files=()
  has_c_flag=false
  
  for i in "${!args[@]}"; do
    if [[ "${args[$i]}" == "-c" ]]; then
      has_c_flag=true
    elif [[ "${args[$i]}" == "-o" ]]; then
      output_file="${args[$((i+1))]}"
    elif [[ "${args[$i]}" != "-o" && "$i" -gt 0 && "${args[$((i-1))]}" == "-o" ]]; then
      continue
    elif [[ "${args[$i]}" == *.c || "${args[$i]}" == *.s ]]; then
      source_files+=("${args[$i]}")
    fi
  done
  
  # If multiple source files with -c, call tcc once per file
  if [[ "$has_c_flag" == true && ${#source_files[@]} -gt 1 ]]; then
    for src in "${source_files[@]}"; do
      "$TCC_ORIG" -c "$src" -o "${src%.c}.o" 2>&1 | grep -v "cannot specify multiple files"
    done
  else
    exec "$TCC_ORIG" "$@"
  fi
else
  exec "$TCC_ORIG" "$@"
fi