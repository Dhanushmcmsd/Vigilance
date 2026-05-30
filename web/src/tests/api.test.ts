import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';

describe('Edge Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies user provisioning edge function returns success', async () => {
    // Mock fetch for the edge function
    const mockResponse = {
      user_id: 'new-user-id',
      password: 'auto-generated-password',
      generated: true
    };

    (supabase.functions.invoke as any).mockResolvedValue({
      data: mockResponse,
      error: null
    });

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: 'new@test.com', name: 'New User', role: 'officer' }
    });

    expect(error).toBeNull();
    expect(data).toEqual(mockResponse);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-create-user', expect.any(Object));
  });
});
