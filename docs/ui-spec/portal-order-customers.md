# UI SPEC — Portal: Chot don (Tin nhan) + Khach hang + Ho so khach
Nguyen tac chung: style portal hien co (xanh PTT, nen trang, bo goc 8px, shadow nhe). Grid 8px. Font: tieu de 16/600, nhan 12/500 mau xam #6b7280, so lieu 14/600 tabular-nums. Tien te: "1.250.000 d" can phai. Moi nut co hover/focus/disabled ro. Khong de khoi nao bi che khi cuon.

Mau trang thai (badge pill, nen nhat + chu dam):
- Moi/Cho xac nhan: xam  | Da xac nhan: xanh duong | Dang dong goi: tim | Dang giao: cam | Da giao/Thanh cong: xanh la | Hoan/Huy: do | Tiem nang: vang.

## 1. Tab "Chot don" (cot phai Tin nhan, rong ~360px)
Cau truc tu tren xuong, phan than cuon, footer tong tien sticky KHONG che noi dung (padding-bottom = chieu cao footer):
A. Khoi Khach: Ten, SDT (bat buoc, validate 10 so), Dia chi: MOT o textarea 2 dong nhu cu (KHONG co 3 select Tinh/Quan/Phuong). Neu SDT da co trong he thong: chip "Khach cu · N don · tong X d" + canh bao neu ty le hoan cao.
B. Khoi San pham:
   - O tim kiem (ten/SKU) -> dropdown ket qua: anh nho 40px, ten, khoang gia, "Con N" hoac "Het hang" (mo, khong chon duoc).
   - Chon SP -> hien "the dang chon": anh, ten, nut X (xoa the) goc phai.
       Mau: hang chip mau (swatch + ten); mau het hang gach ngang, disabled.
       Size: hang chip size, chi hien size cua mau da chon; het hang disabled. SP khong co bien the thi bo qua 2 hang nay.
       So luong: stepper [-] n [+], max = ton cua bien the; hien "Con N".
       Gia: lay tu bien the, chi doc. Dong "Thanh tien" = gia x SL.
       Nut "Them vao don" (primary, full width); disabled kem ly do nho ben duoi (vd "Chon size").
   - Danh sach dong da them (bang gon): anh 32px | ten + "Mau / Size" xam | stepper SL | thanh tien | icon thung rac (luon bam duoc, hover do). Rong thi hien empty state "Chua co san pham".
C. Khoi Thanh toan: Giam gia, Phi van chuyen, Dat coc (input tien, can phai), Ghi chu.
D. Footer sticky: Tam tinh / Giam / VC / Coc -> TONG COD (chu lon, xanh). Nut "Chot don" primary full width; disabled kem ly do (thieu SDT, chua co SP, vuot ton, tong = 0).
Sau khi chot: toast "Da tao don DH-xxx" + link mo don; form reset; hoi thoai gan nhan "Da mua".

## 2. Trang Khach hang (/client/crm/customers)
Header: tieu de "Khach hang" + mo ta ngan; ben phai nut "+ Tao don".
Tabs: "Khach hang (co don)" | "Tiem nang (chua don)" kem so dem.
Thanh loc 1 hang: tim kiem (ten/SDT) | Nguon | Nhan vien | Trang thai don gan nhat | Khoang ngay mua.
Bang (header dinh khi cuon, hang cao 48px, hover nen nhat, hang dang chon vien trai xanh):
 Khach (avatar chu cai + ten dam, SDT xam ben duoi) | Nguon (badge) | So don | Tong chi tieu (can phai) | Gia tri TB | Lan mua gan nhat (ngay + "x ngay truoc") | Trang thai don gan nhat (badge) | Nhan vien (avatar + ten, khong hien email tho).
Phan trang 20/50/100, sap xep theo cot so va ngay.
Tab Tiem nang: Khach | Nguon | Ngay lien he | Nhan vien | nut "Chot don" (mo tao don voi SDT dien san).

## 3. Panel Ho so khach (drawer phai ~45% hoac trang rieng)
- Header: avatar lon, Ten, SDT (nut copy, goi), nhan (tag), nhan vien phu trach, "Khach tu dd/mm/yyyy". Nut: "+ Tao don", "Gui tin", menu ... (Han che, Sua).
- 4 the KPI ngang: Tong don | Tong chi tieu | Gia tri TB/don | Ty le hoan (do neu > 20%).
- Tabs: Don hang | Hoat dong | Thong tin.
  - Don hang: bang Ma don (link) | Ngay | San pham (ten x SL, "Mau/Size", +n neu nhieu) | Tong tien | COD | Trang thai (badge) | Van chuyen (badge + ma van don) | NV. Bam -> drawer chi tiet don: thong tin giao, tung dong SP, tong ket tien, lich su trang thai (timeline).
  - Hoat dong: timeline doc theo thoi gian: tin nhan, lead tao, ghi chu, don tao/doi trang thai (icon + mau theo loai).
  - Thong tin: dia chi, ghi chu, nguon dau tien, page.
- Empty state co minh hoa nhe + hanh dong (vd "Chua co don — Tao don dau tien").

