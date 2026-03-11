import { useAuth } from '../../lib/authContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { ShieldX, Package, Mail } from 'lucide-react';

export default function AccessDenied() {
  const { msalAccount, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 p-3 rounded-full">
              <ShieldX className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription className="text-base mt-1">
            Your account is not authorized to access the SHC Inventory System.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {msalAccount && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 flex items-center gap-2 justify-center">
              <Mail className="h-4 w-4 shrink-0" />
              <span>Signed in as <strong>{msalAccount.username}</strong></span>
            </div>
          )}

          <p className="text-sm text-gray-500">
            To request access, contact your system administrator and provide your university email address.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              onClick={logout}
              className="w-full"
            >
              Sign out and try a different account
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-2">
            <Package className="h-3 w-3" />
            <span>SHC Inventory System</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
