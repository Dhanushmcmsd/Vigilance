-- Fix check constraint to allow 'Good', 'Moderate', 'Bad' values for staff behavior assessment
-- Previously only allowed: 'Yes', 'No', 'N/A'
-- Now allows: 'Yes', 'No', 'N/A', 'Good', 'Moderate', 'Bad'

ALTER TABLE public.inspection_responses 
DROP CONSTRAINT inspection_responses_response_check;

ALTER TABLE public.inspection_responses 
ADD CONSTRAINT inspection_responses_response_check 
CHECK (response IN ('Yes', 'No', 'N/A', 'Good', 'Moderate', 'Bad'));
