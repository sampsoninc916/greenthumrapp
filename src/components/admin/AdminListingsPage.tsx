import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import {
  adminService,
  type AdminListing,
  type ListingStatus,
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
import { AlertTriangle, CheckCircle2, MoreHorizontal, RefreshCw, ShieldX } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { buildComplianceContext, getComplianceHighlights, hasCompliance } from '../../utils/compliance';

type StatusFilter = 'all' | ListingStatus;
type FlagFilter = 'all' | 'flagged' | 'clean';

const statusStyles: Record<ListingStatus, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  taken_down: 'bg-rose-100 text-rose-700',
  flagged: 'bg-orange-100 text-orange-700',
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

export const AdminListingsPage = () => {
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');
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

  const loadListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminService.fetchListings({
        status: statusFilter === 'all' ? undefined : statusFilter,
        flagged: flagFilter === 'all' ? undefined : flagFilter === 'flagged',
        query: debouncedSearch || undefined,
      });
      setListings(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load listings.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, flagFilter, debouncedSearch]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const metrics = useMemo(() => {
    const pending = listings.filter((listing) => listing.status === 'pending').length;
    const flagged = listings.filter((listing) => listing.status === 'flagged' || listing.flaggedCount).length;
    const takenDown = listings.filter((listing) => listing.status === 'taken_down').length;
    const approved = listings.filter((listing) => listing.status === 'approved').length;
    return { pending, flagged, takenDown, approved };
  }, [listings]);

  const updateListingInState = (updated: AdminListing) => {
    setListings((current) => current.map((listing) => (listing.id === updated.id ? updated : listing)));
  };

  const handleApproveListing = async (listing: AdminListing) => {
    try {
      const notes = listing.status === 'flagged' ? window.prompt('Add optional approval notes') ?? undefined : undefined;
      const updated = await adminService.approveListing(listing.id, notes);
      updateListingInState(updated);
      toast.success(`Listing "${listing.title}" approved.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to approve listing.';
      toast.error(message);
    }
  };

  const handleTakeDownListing = async (listing: AdminListing) => {
    const reason = window.prompt(`Provide a reason for taking down "${listing.title}"`, 'Safety or policy violation');
    if (reason === null) {
      return;
    }

    try {
      const updated = await adminService.takeDownListing(listing.id, reason || '');
      updateListingInState(updated);
      toast.success(`Listing "${listing.title}" removed from the marketplace.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to take down listing.';
      toast.error(message);
    }
  };

  return (
    <AdminLayout
      active="listings"
      title="Listing Moderation"
      description="Review submissions, keep quality high, and respond quickly to potential risks."
      onSearch={setSearchTerm}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-100 bg-green-50/60">
          <CardHeader>
            <CardDescription>Pending approval</CardDescription>
            <CardTitle className="text-2xl text-green-900">{metrics.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Flagged for review</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{metrics.flagged}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Approved listings</CardDescription>
            <CardTitle className="text-2xl text-green-700">{metrics.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Removed</CardDescription>
            <CardTitle className="text-2xl text-rose-600">{metrics.takenDown}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-muted/40 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-1">
              <span className="text-sm font-medium text-muted-foreground">Search</span>
              <Input
                placeholder="Search by title, seller, or listing id"
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="taken_down">Taken down</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Risk</span>
                <Select value={flagFilter} onValueChange={(value) => setFlagFilter(value as FlagFilter)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="clean">No flags</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="self-end" onClick={loadListings} disabled={isLoading}>
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
                <TableHead className="pl-6">Listing</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Loading listings…
                  </TableCell>
                </TableRow>
              ) : listings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No listings match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{listing.title}</span>
                        <span className="text-xs text-muted-foreground">ID: {listing.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{listing.sellerName ?? 'Unknown seller'}</span>
                        <span className="text-xs text-muted-foreground">{listing.sellerId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusStyles[listing.status] ?? ''}>{listing.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>{listing.category ?? '—'}</TableCell>
                    <TableCell>{listing.price !== undefined ? formatCurrency(listing.price) : '—'}</TableCell>
                    <TableCell>{formatTimestamp(listing.submittedAt)}</TableCell>
                    <TableCell>
                      {(() => {
                        const context = buildComplianceContext(
                          listing.compliance,
                          listing.livePlantWarranty,
                        );
                        const highlights = getComplianceHighlights(
                          listing.compliance,
                          listing.livePlantWarranty,
                        );
                        if (!hasCompliance(context) && !context.phytosanitaryDetails) {
                          return <span className="text-xs text-muted-foreground">None reported</span>;
                        }
                        return (
                          <div className="flex flex-col gap-1">
                            {highlights.map((highlight) => (
                              <Badge
                                key={`${listing.id}-${highlight}`}
                                variant="outline"
                                className="w-fit border-amber-200 bg-amber-50 text-amber-900"
                              >
                                {highlight}
                              </Badge>
                            ))}
                            {context.phytosanitaryDetails && (
                              <p className="text-xs text-muted-foreground">{context.phytosanitaryDetails}</p>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {listing.flaggedCount ? (
                        <Badge variant="secondary" className="flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {listing.flaggedCount}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Clear
                        </Badge>
                      )}
                      {listing.flaggedReason && (
                        <p className="mt-1 text-xs text-muted-foreground">{listing.flaggedReason}</p>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {listing.status !== 'approved' && listing.status !== 'taken_down' && (
                            <DropdownMenuItem onClick={() => handleApproveListing(listing)}>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              Approve listing
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleTakeDownListing(listing)}>
                            <ShieldX className="mr-2 h-4 w-4 text-rose-600" />
                            Take down
                          </DropdownMenuItem>
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

