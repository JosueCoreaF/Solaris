filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("Lines 2065-2085:")
for i in range(2065, 2085):
    print(f"Line {i+1}: {lines[i].strip().encode('ascii', 'replace').decode('ascii')}")

print("\nLines 2725-2740:")
for i in range(2725, min(2740, len(lines))):
    print(f"Line {i+1}: {lines[i].strip().encode('ascii', 'replace').decode('ascii')}")
