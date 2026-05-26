filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    for i in range(300):
        print(f"Line {i+1}: {f.readline().strip().encode('ascii', 'replace').decode('ascii')}")
