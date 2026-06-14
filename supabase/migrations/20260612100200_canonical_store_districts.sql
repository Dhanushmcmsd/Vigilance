-- Canonical Vigilance store → Kerala district mapping (80 stores, 12 districts).
-- Fixes stores.region and branches.region used by management dashboard tabs.

UPDATE public.stores s
SET region = m.district
FROM (
  VALUES
    -- Thiruvananthapuram (11)
    ('V180', 'Thiruvananthapuram'),
    ('V124', 'Thiruvananthapuram'),
    ('V159', 'Thiruvananthapuram'),
    ('V122', 'Thiruvananthapuram'),
    ('V158', 'Thiruvananthapuram'),
    ('V177', 'Thiruvananthapuram'),
    ('V129', 'Thiruvananthapuram'),
    ('V136', 'Thiruvananthapuram'),
    ('V181', 'Thiruvananthapuram'),
    ('V128', 'Thiruvananthapuram'),
    ('V148', 'Thiruvananthapuram'),
    -- Kollam (9)
    ('V102', 'Kollam'),
    ('V107', 'Kollam'),
    ('V105', 'Kollam'),
    ('V197', 'Kollam'),
    ('V176', 'Kollam'),
    ('V101', 'Kollam'),
    ('V191', 'Kollam'),
    ('V182', 'Kollam'),
    ('V121', 'Kollam'),
    -- Pathanamthitta (6)
    ('V104', 'Pathanamthitta'),
    ('V175', 'Pathanamthitta'),
    ('V123', 'Pathanamthitta'),
    ('V117', 'Pathanamthitta'),
    ('V125', 'Pathanamthitta'),
    ('V143', 'Pathanamthitta'),
    -- Alappuzha (14)
    ('V140', 'Alappuzha'),
    ('V150', 'Alappuzha'),
    ('V116', 'Alappuzha'),
    ('V106', 'Alappuzha'),
    ('V103', 'Alappuzha'),
    ('V115', 'Alappuzha'),
    ('V137', 'Alappuzha'),
    ('V113', 'Alappuzha'),
    ('V119', 'Alappuzha'),
    ('V139', 'Alappuzha'),
    ('V133', 'Alappuzha'),
    ('V126', 'Alappuzha'),
    ('V127', 'Alappuzha'),
    ('V134', 'Alappuzha'),
    -- Kottayam (7)
    ('V166', 'Kottayam'),
    ('V179', 'Kottayam'),
    ('V163', 'Kottayam'),
    ('V130', 'Kottayam'),
    ('V164', 'Kottayam'),
    ('V145', 'Kottayam'),
    ('V165', 'Kottayam'),
    -- Ernakulam (4)
    ('V189', 'Ernakulam'),
    ('V112', 'Ernakulam'),
    ('V138', 'Ernakulam'),
    ('V153', 'Ernakulam'),
    -- Thrissur (10)
    ('V190', 'Thrissur'),
    ('V135', 'Thrissur'),
    ('V161', 'Thrissur'),
    ('V109', 'Thrissur'),
    ('V146', 'Thrissur'),
    ('V151', 'Thrissur'),
    ('V108', 'Thrissur'),
    ('V132', 'Thrissur'),
    ('V149', 'Thrissur'),
    ('V144', 'Thrissur'),
    -- Palakkad (9)
    ('V111', 'Palakkad'),
    ('V152', 'Palakkad'),
    ('V167', 'Palakkad'),
    ('V196', 'Palakkad'),
    ('V178', 'Palakkad'),
    ('V147', 'Palakkad'),
    ('V142', 'Palakkad'),
    ('V195', 'Palakkad'),
    ('V168', 'Palakkad'),
    -- Malappuram (3)
    ('V170', 'Malappuram'),
    ('V173', 'Malappuram'),
    ('V169', 'Malappuram'),
    -- Kozhikode (5)
    ('V172', 'Kozhikode'),
    ('V198', 'Kozhikode'),
    ('V184', 'Kozhikode'),
    ('V185', 'Kozhikode'),
    ('V171', 'Kozhikode'),
    -- Wayanad (1)
    ('V188', 'Wayanad'),
    -- Kannur (1)
    ('V183', 'Kannur')
) AS m(code, district)
WHERE s.store_code = m.code;

-- Sync branches linked by store_code.
UPDATE public.branches b
SET region = s.region
FROM public.stores s
WHERE b.store_code = s.store_code
  AND s.region IS NOT NULL;

-- Link branches missing store_code but matching store name.
UPDATE public.branches b
SET
  region = s.region,
  store_code = COALESCE(b.store_code, s.store_code)
FROM public.stores s
WHERE s.region IS NOT NULL
  AND (
    b.store_code = s.store_code
    OR (
      b.store_code IS NULL
      AND UPPER(TRIM(b.branch_name)) = UPPER(TRIM(s.name))
    )
  );

-- Normalize legacy zone labels and city-as-district values on branches.
UPDATE public.branches
SET region = CASE
  WHEN region ILIKE '%thiruvananthapuram%' OR region ILIKE '%trivandrum%' THEN 'Thiruvananthapuram'
  WHEN region ILIKE '%kollam%' OR region ILIKE '%kolam%' THEN 'Kollam'
  WHEN region ILIKE '%pathanamthitta%' THEN 'Pathanamthitta'
  WHEN region ILIKE '%alappuzha%' THEN 'Alappuzha'
  WHEN region ILIKE '%kottayam%' THEN 'Kottayam'
  WHEN region ILIKE '%ernakulam%' THEN 'Ernakulam'
  WHEN region ILIKE '%thrissur%' THEN 'Thrissur'
  WHEN region ILIKE '%palakkad%' THEN 'Palakkad'
  WHEN region ILIKE '%malappuram%' THEN 'Malappuram'
  WHEN region ILIKE '%kozhikode%' THEN 'Kozhikode'
  WHEN region ILIKE '%wayanad%' THEN 'Wayanad'
  WHEN region ILIKE '%kannur%' THEN 'Kannur'
  ELSE region
END
WHERE region IS NOT NULL
  AND region NOT IN (
    'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
    'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur'
  );

-- Map city field to district when region still uses legacy Kerala zones.
UPDATE public.branches
SET region = CASE city
  WHEN 'Trivandrum' THEN 'Thiruvananthapuram'
  WHEN 'Thiruvananthapuram' THEN 'Thiruvananthapuram'
  WHEN 'Kollam' THEN 'Kollam'
  WHEN 'Pathanamthitta' THEN 'Pathanamthitta'
  WHEN 'Alappuzha' THEN 'Alappuzha'
  WHEN 'Kottayam' THEN 'Kottayam'
  WHEN 'Ernakulam' THEN 'Ernakulam'
  WHEN 'Thrissur' THEN 'Thrissur'
  WHEN 'Palakkad' THEN 'Palakkad'
  WHEN 'Malappuram' THEN 'Malappuram'
  WHEN 'Kozhikode' THEN 'Kozhikode'
  WHEN 'Wayanad' THEN 'Wayanad'
  WHEN 'Kannur' THEN 'Kannur'
  ELSE region
END
WHERE region IN ('South Kerala', 'Central Kerala', 'North Kerala', 'Kerala')
  AND city IS NOT NULL;
