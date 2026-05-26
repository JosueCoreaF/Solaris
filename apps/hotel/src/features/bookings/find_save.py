filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "async function handleSave" in line or "const todayStr" in line:
        pass
    
start_idx = -1
for i, line in enumerate(lines):
    if "async function handleSave" in line:
        start_idx = i
        break

if start_idx != -1:
    for i in range(start_idx, start_idx + 30):
        print(f"Line {i+1}: {lines[i].strip().encode('ascii', 'replace').decode('ascii')}")
