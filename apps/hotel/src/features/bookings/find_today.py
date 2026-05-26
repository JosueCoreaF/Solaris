filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if "todayStr" in line:
            print(f"Line {i+1}: {line.strip()}")
