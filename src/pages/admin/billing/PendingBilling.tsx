import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DollarSign, Users, Receipt, RefreshCw, Loader2, ArrowLeft } from 'lucide-react';
import { useWaitlist } from '@/hooks/data/useWaitlist';
import { UserBillingModal } from '@/components/admin/billing';
import type { UserWithPromotedEntries } from '@/types';

/**
 * Admin page for managing pending billing
 * Shows all users with promoted waitlist entries that need to be billed
 */
export const PendingBilling: FC = () => {
  const { getUsersWithPromotedEntries } = useWaitlist();

  const [users, setUsers] = useState<UserWithPromotedEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingDialog, setBillingDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    userEmail: string;
  }>({
    open: false,
    userId: '',
    userName: '',
    userEmail: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    const data = await getUsersWithPromotedEntries();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchUsers();
  }, [getUsersWithPromotedEntries]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const totalPending = users.reduce((sum, u) => sum + u.totalAmount, 0);
  const totalTournaments = users.reduce((sum, u) => sum + u.promotedEntries.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/waitlist">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Waitlist
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-viking text-white">Pending Billing</h1>
          <p className="text-white/80 mt-2">
            Users with promoted waitlist entries ready for billing
          </p>
        </div>
        <Button variant="outline" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users Pending</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{users.length}</div>
            <p className="text-xs text-white/70 mt-1">
              with promoted entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tournaments</CardTitle>
            <Receipt className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalTournaments}</div>
            <p className="text-xs text-white/70 mt-1">
              to be invoiced
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-white/70 mt-1">
              tournament fees only
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Users Awaiting Invoice
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-white">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading pending billing...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-white/80">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users with pending billing.</p>
              <p className="text-sm text-white/60 mt-1">
                Promote users from the waitlist to see them here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4 font-semibold text-white">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Tournaments</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Amount</th>
                    <th className="text-right py-3 px-4 font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr
                      key={user.userId}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">
                          {user.firstName} {user.lastName}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {user.promotedEntries.map(entry => (
                            <div key={entry.id} className="text-sm">
                              <span className="text-white">{entry.tournament.name}</span>
                              <span className="text-white/50 ml-2">
                                {formatDate(entry.tournament.date)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-orange-400">
                          {formatCurrency(user.totalAmount)}
                        </p>
                        <p className="text-xs text-white/50">
                          {user.promotedEntries.length} tournament{user.promotedEntries.length !== 1 ? 's' : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => setBillingDialog({
                              open: true,
                              userId: user.userId,
                              userName: `${user.firstName} ${user.lastName}`,
                              userEmail: user.email,
                            })}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Bill User
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Modal */}
      <UserBillingModal
        open={billingDialog.open}
        onOpenChange={(open) => setBillingDialog({ ...billingDialog, open })}
        userId={billingDialog.userId}
        userName={billingDialog.userName}
        userEmail={billingDialog.userEmail}
        onSuccess={fetchUsers}
      />
    </div>
  );
};

export default PendingBilling;
