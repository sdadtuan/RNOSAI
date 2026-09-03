'use client';

import { IwrAppShell } from '@/components/crm/iwr/IwrAppShell';
import { IwrInboxWorkspace } from '@/components/crm/iwr/IwrInboxWorkspace';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';

export default function IwrInboxPage() {
  const { user, token, error, setError, logout, canWrite, canReview } = useIwrPageAuth('view');

  return (
    <IwrAppShell user={user} token={token} onLogout={logout} loading={!user} canWrite={canWrite}>
      {token ? (
        <IwrInboxWorkspace
          token={token}
          canWrite={canWrite}
          canReview={canReview}
          error={error}
          onError={setError}
        />
      ) : null}
    </IwrAppShell>
  );
}
