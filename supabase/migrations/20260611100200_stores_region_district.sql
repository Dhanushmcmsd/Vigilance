ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS store_code text;

UPDATE public.stores SET region = CASE
  WHEN address ~* '(Thiruvananthapuram|Trivandrum)\s*(District|Dist)' THEN 'Thiruvananthapuram'
  WHEN address ~* '(Kollam|Kolam)\s*(District|Dist)' THEN 'Kollam'
  WHEN address ~* 'Pathanamthitta\s*(District|Dist)' THEN 'Pathanamthitta'
  WHEN address ~* 'Alappuzha\s*(District|Dist)' THEN 'Alappuzha'
  WHEN address ~* 'Kottayam\s*(District|Dist)' THEN 'Kottayam'
  WHEN address ~* 'Ernakulam\s*(District|Dist)' THEN 'Ernakulam'
  WHEN address ~* 'Thrissur\s*(District|Dist)' THEN 'Thrissur'
  WHEN address ~* 'Palakkad\s*(District|Dist)' THEN 'Palakkad'
  WHEN address ~* 'Malappuram\s*(District|Dist)' THEN 'Malappuram'
  WHEN address ~* 'Kozhikode\s*(District|Dist)' THEN 'Kozhikode'
  WHEN address ~* 'Wayanad\s*(District|Dist)' THEN 'Wayanad'
  WHEN address ~* 'Kannur\s*(District|Dist)' THEN 'Kannur'
  WHEN address ~* 'Thiruvananthapuram|Trivandrum' THEN 'Thiruvananthapuram'
  WHEN address ~* 'Kollam|Kolam District' THEN 'Kollam'
  WHEN address ~* 'Pathanamthitta' THEN 'Pathanamthitta'
  WHEN address ~* 'Alappuzha' THEN 'Alappuzha'
  WHEN address ~* 'Kottayam' THEN 'Kottayam'
  WHEN address ~* 'Ernakulam' THEN 'Ernakulam'
  WHEN address ~* 'Thrissur' THEN 'Thrissur'
  WHEN address ~* 'Palakkad' THEN 'Palakkad'
  WHEN address ~* 'Malappuram' THEN 'Malappuram'
  WHEN address ~* 'Kozhikode' THEN 'Kozhikode'
  WHEN address ~* 'Wayanad' THEN 'Wayanad'
  WHEN address ~* 'Kannur' THEN 'Kannur'
  ELSE NULL
END
WHERE region IS NULL;

UPDATE public.branches b
SET region = s.region
FROM public.stores s
WHERE b.store_code = s.store_code
  AND s.region IS NOT NULL
  AND (b.region IS NULL OR b.region = 'Kerala');

CREATE INDEX IF NOT EXISTS idx_stores_region ON public.stores(region) WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branches_region ON public.branches(region) WHERE region IS NOT NULL;
