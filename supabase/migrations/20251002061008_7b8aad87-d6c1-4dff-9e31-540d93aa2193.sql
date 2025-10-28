-- Add contact_id column to call_logs table
ALTER TABLE call_logs 
ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_call_logs_contact_id ON call_logs(contact_id);

-- Update existing call_logs to link with contacts based on phone number
UPDATE call_logs cl
SET contact_id = c.id
FROM contacts c
WHERE cl.user_id = c.user_id 
  AND (cl.phone_number = c.phone_number OR cl.caller_number = c.phone_number)
  AND cl.contact_id IS NULL;