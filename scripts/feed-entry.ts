// Điểm vào cho check:feed. Route nằm trong thư mục có dấu ngoặc vuông, và
// esbuild coi đó là ký tự đặc biệt của shell trên vài nền tảng — một tệp nhỏ
// nhập giúp thì không phải đoán.
export { GET } from "@/app/feed/[token]/route";
export { parseIcal } from "@/lib/ical";
