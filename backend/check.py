# check.py - Find the predict function
import re

with open('app.py', 'r') as f:
    content = f.read()
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        if '/api/predict' in line or 'def predict' in line:
            print(f'\n=== Found at line {i+1}: ===')
            print(f'{i+1}: {line}')
            
            # Show 10 lines before and 20 lines after
            start = max(0, i - 10)
            end = min(len(lines), i + 25)
            
            for j in range(start, end):
                print(f'{j+1:3}: {lines[j]}')
            
            # Also check for file handling
            for j in range(i, min(len(lines), i + 30)):
                if 'request.files' in lines[j]:
                    print(f'\n!!! Found request.files at line {j+1}:')
                    print(f'{j+1}: {lines[j]}')
                    # Look for the key name
                    match = re.search(r"request\.files\[['\"](.*?)['\"]\]", lines[j])
                    if match:
                        print(f'Key name should be: "{match.group(1)}"')
                    match = re.search(r"files\.get\(['\"](.*?)['\"]\)", lines[j])
                    if match:
                        print(f'Key name should be: "{match.group(1)}"')
            break