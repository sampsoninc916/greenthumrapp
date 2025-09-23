import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import {
  adminService,
  type AdminDispute,
  type DisputeSeverity,
  type DisputeStatus,
} from '../../services/admin';
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
import { AlertTriangle, ArrowUpRight, Gavel, MoreHorizontal, RefreshCw } from 'lucide-react';

type StatusFilter = 'all' | DisputeStatus;
type SeverityFilter = 'all' | DisputeSeverity;

const statusStyles: Record<DisputeStatus, string> = {
  open: 'bg-amber-100 text-amber-700',
  investigating: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  escalated: 'bg-rose-100 text-rose-700',
};

const severityStyles: Record<DisputeSeverity, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

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

export const AdminDisputesPage = () => {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
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

  const loadDisputes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminService.fetchDisputes({
        status: statusFilter === 'all' ? undefined : statusFilter,
        severity: severityFilter === 'all' ? undefined : severityFilter,
        query: debouncedSearch || undefined,
      });
      setDisputes(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load disputes.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, severityFilter, debouncedSearch]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const metrics = useMemo(() => {
    const open = disputes.filter((dispute) => dispute.status === 'open').length;
    const investigating = disputes.filter((dispute) => dispute.status === 'investigating').length;
    const escalated = disputes.filter((dispute) => dispute.status === 'escalated').length;
    const resolved = disputes.filter((dispute) => dispute.status === 'resolved').length;
    return { open, investigating, escalated, resolved };
  }, [disputes]);

  const updateDisputeInState = (updated: AdminDispute) => {
    setDisputes((current) => current.map((dispute) => (dispute.id === updated.id ? updated : dispute)));
  };

  const handleResolveDispute = async (dispute: AdminDispute) => {
    const resolutionNotes = window.prompt('Add a short resolution summary for the buyer and seller', 'Partial refund issued');
    if (resolutionNotes === null) {
      return;
    }

    try {
      const updated = await adminService.resolveDispute(dispute.id, resolutionNotes || '');
      updateDisputeInState(updated);
      toast.success(`Dispute ${dispute.id} marked as resolved.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resolve dispute.';
      toast.error(message);
    }
  };

  const handleEscalateDispute = async (dispute: AdminDispute) => {
    const escalationReason = window.prompt('Why is this dispute being escalated?', 'Requires manual payout review');
    if (escalationReason === null) {
      return;
    }

    try {
      const updated = await adminService.escalateDispute(dispute.id, escalationReason || '');
      updateDisputeInState(updated);
      toast.success(`Dispute ${dispute.id} escalated to the specialist queue.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to escalate dispute.';
      toast.error(message);
    }
  };

  return (
    <AdminLayout
      active="disputes"
      title="Dispute Resolution"
      description="Track buyer and seller conflicts, intervene quickly, and keep transactions fair."
      onSearch={setSearchTerm}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-100 bg-green-50/60">
          <CardHeader>
            <CardDescription>Open cases</CardDescription>
            <CardTitle className="text-2xl text-green-900">{metrics.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Investigating</CardDescription>
            <CardTitle className="text-2xl text-blue-700">{metrics.investigating}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Escalated</CardDescription>
            <CardTitle className="text-2xl text-rose-600">{metrics.escalated}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Resolved this week</CardDescription>
            <CardTitle className="text-2xl text-emerald-700">{metrics.resolved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-muted/40 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted-foreground">Search</span>
              <Input
                placeholder="Search disputes by ID, listing, or participant"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="md:w-96"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Severity</span>
                <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as SeverityFilter)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="self-end" onClick={loadDisputes} disabled={isLoading}>
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
                <TableHead className="pl-6">Dispute</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Loading dispute queue…
                  </TableCell>
                </TableRow>
              ) : disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No disputes match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">Case #{dispute.id}</span>
                        <span className="text-xs text-muted-foreground">
                          Buyer: {dispute.buyerName ?? dispute.buyerId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Seller: {dispute.sellerName ?? dispute.sellerId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{dispute.listingTitle}</span>
                        <span className="text-xs text-muted-foreground">{dispute.listingId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusStyles[dispute.status] ?? ''}>{dispute.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {dispute.severity ? (
                        <Badge className={severityStyles[dispute.severity]}>{dispute.severity}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Unset
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatTimestamp(dispute.openedAt)}</TableCell>
                    <TableCell>{formatTimestamp(dispute.updatedAt)}</TableCell>
                    <TableCell className="max-w-sm">
                      {dispute.summary ? (
                        <span className="line-clamp-2 text-sm text-muted-foreground">{dispute.summary}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No summary provided.</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {dispute.status !== 'resolved' && (
                            <DropdownMenuItem onClick={() => handleResolveDispute(dispute)}>
                              <Gavel className="mr-2 h-4 w-4 text-green-600" />
                              Resolve dispute
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEscalateDispute(dispute)}>
                            <ArrowUpRight className="mr-2 h-4 w-4 text-amber-600" />
                            Escalate for review
                          </DropdownMenuItem>
                          {dispute.severity && dispute.severity !== 'low' && (
                            <div className="px-2 pt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle className="h-3 w-3" />
                                High priority case
                              </div>
                            </div>
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

