filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "mouseenter" in line.lower() or "mouseover" in line.lower() or "mouseup" in line.lower():
        if any(term in line.lower() for term in ["cell", "resizing", "moving", "state", "hover"]):
            print(f"Line {i}: {line.strip()}")
