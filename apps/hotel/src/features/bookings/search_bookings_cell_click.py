filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1070):
    if i < len(lines):
        line_content = lines[i]
        if "onclick" in line_content.lower():
            print(f"Line {i+1}: {line_content.strip()}")
