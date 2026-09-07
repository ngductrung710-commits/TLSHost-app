-- Mã quốc gia đã bị ISO 3166-1 rút, đưa về mã hiện hành.
--
-- Danh sách quốc gia trong ứng dụng sinh ra từ một bản CLDR có kèm mã lịch sử,
-- nên mỗi nước dưới đây xuất hiện hai lần với cùng một tên hiển thị. Chủ nhà
-- không có cách nào phân biệt, và đã có dòng lưu trúng mã chết: 2 trong 4 cơ
-- sở đang mang "VD" — mã của Việt Nam Dân chủ Cộng hòa.
--
-- Mã cũ vừa bị gỡ khỏi danh sách chọn, nên không có dòng mới nào mang chúng
-- nữa. Migration này dọn những dòng đã lỡ.
UPDATE "property" SET "countryCode" = CASE "countryCode"
  WHEN 'DY' THEN 'BJ'  -- Dahomey
  WHEN 'HV' THEN 'BF'  -- Haute-Volta
  WHEN 'ZR' THEN 'CD'  -- Zaire
  WHEN 'AN' THEN 'CW'  -- Netherlands Antilles
  WHEN 'DD' THEN 'DE'  -- Đông Đức
  WHEN 'BU' THEN 'MM'  -- Miến Điện
  WHEN 'SU' THEN 'RU'  -- Liên Xô
  WHEN 'FX' THEN 'FR'  -- Metropolitan France
  WHEN 'CS' THEN 'RS'  -- Serbia và Montenegro
  WHEN 'YU' THEN 'RS'  -- Nam Tư
  WHEN 'TP' THEN 'TL'  -- Đông Timor, mã cũ
  WHEN 'NH' THEN 'VU'  -- New Hebrides
  WHEN 'VD' THEN 'VN'  -- Việt Nam Dân chủ Cộng hòa
  WHEN 'UK' THEN 'GB'  -- UK là mã dành riêng, GB mới là mã ISO
  WHEN 'YD' THEN 'YE'  -- Nam Yemen
  WHEN 'RH' THEN 'ZW'  -- Rhodesia
  ELSE "countryCode"
END
WHERE "countryCode" IN
  ('DY','HV','ZR','AN','DD','BU','SU','FX','CS','YU','TP','NH','VD','UK','YD','RH');
