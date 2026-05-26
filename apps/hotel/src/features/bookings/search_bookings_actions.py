filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "ctxMenu" in line or "handleSave" in line or "isPast" in line or "check_in" in line.lower() or "check_out" in line.lower() or "updateestado" in line.lower():
        print(f"Line {i}: {line.strip().encode('ascii', 'replace').decode('ascii')}")
