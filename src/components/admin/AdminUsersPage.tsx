import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { adminService, type AdminUser, type UserStatus } from '../../services/admin';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { MoreHorizontal, RefreshCw } from 'lucide-react';

type RoleFilter = 'all' | 'buyer' | 'seller' | 'admin';
type StatusFilter = 'all' | UserStatus;

const formatTimestamp = (value?: string) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const statusStyles: Record<UserStatus, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  under_review: 'bg-orange-100 text-orange-700',
};

export const AdminUsersPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminService.fetchUsers({
        status: statusFilter === 'all' ? undefined : statusFilter,
        role: roleFilter === 'all' ? undefined : roleFilter,
        query: debouncedSearch || undefined,
      });
      setUsers(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load users.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, roleFilter, debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const metrics = useMemo(() => {
    const total = users.length;
    const suspended = users.filter((user) => user.status === 'suspended').length;
    const underReview = users.filter((user) => user.status === 'under_review').length;
    const pending = users.filter((user) => user.status === 'pending').length;
    const active = users.filter((user) => user.status === 'active').length;

    return { total, suspended, pending, underReview, active };
  }, [users]);

  const updateUserInState = (updated: AdminUser) => {
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
  };

  const handleSuspendUser = async (user: AdminUser) => {
    const reason = window.prompt(`Provide a suspension reason for ${user.username}`, 'Violation of community guidelines');
    if (reason === null) {
      return;
    }

    try {
      const updated = await adminService.updateUserStatus(user.id, 'suspended', reason || undefined);
      updateUserInState(updated);
      toast.success(`${user.username} has been suspended.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to suspend user.';
      toast.error(message);
    }
  };

  const handleReinstateUser = async (user: AdminUser) => {
    try {
      const updated = await adminService.updateUserStatus(user.id, 'active');
      updateUserInState(updated);
      toast.success(`${user.username} has been reinstated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reinstate user.';
      toast.error(message);
    }
  };

  return (
    <AdminLayout
      active="users"
      title="User Oversight"
      description="Monitor account health, respond to abuse reports, and keep the community safe."
      onSearch={setSearchTerm}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-100 bg-green-50/60">
          <CardHeader>
            <CardDescription>Total Accounts</CardDescription>
            <CardTitle className="text-2xl text-green-900">{metrics.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl text-green-700">{metrics.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Suspended</CardDescription>
            <CardTitle className="text-2xl text-red-600">{metrics.suspended}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Under Review</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{metrics.underReview}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-muted/40 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted-foreground">Search</span>
              <Input
                placeholder="Search by username, email, or user id"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="md:w-80"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under review</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Role</span>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="self-end" onClick={loadUsers} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="pl-6">User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Reports</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Loading user directory…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No users found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{user.username}</span>
                        <span className="text-xs text-muted-foreground">ID: {user.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusStyles[user.status] ?? ''}>{user.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>{formatTimestamp(user.createdAt)}</TableCell>
                    <TableCell>{formatTimestamp(user.lastActiveAt)}</TableCell>
                    <TableCell>{user.reportsCount ?? 0}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {user.status === 'suspended' ? (
                            <DropdownMenuItem onClick={() => handleReinstateUser(user)}>
                              Reinstate account
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleSuspendUser(user)}>
                              Suspend account
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

