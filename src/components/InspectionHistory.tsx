import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle, AlertTriangle, XCircle, Download, Eye,
  Calendar, User, MapPin, Camera
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Inspection {
  id: string;
  job_site_id: string;
  inspector_id: string;
  employee_id: string | null;
  status: string;
  overall_score: number | null;
  overall_rating: 'green' | 'yellow' | 'red' | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  job_sites: { name: string; address: string | null };
  profiles: { first_name: string; last_name: string };
  employee?: { first_name: string; last_name: string } | null;
}

interface InspectionItem {
  id: string;
  category: string;
  item_name: string;
  rating: 'green' | 'yellow' | 'red' | null;
  notes: string | null;
  sort_order: number;
  inspection_photos: InspectionPhoto[];
}

interface InspectionPhoto {
  id: string;
  public_url: string | null;
  storage_path: string;
  caption: string | null;
}

const RatingBadge = ({ rating }: { rating: 'green' | 'yellow' | 'red' | null }) => {
  if (!rating) return <Badge variant="outline" className="text-xs">Not rated</Badge>;
  const config = {
    green: { label: 'Green', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    yellow: { label: 'Yellow', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
    red: { label: 'Red', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  };
  const c = config[rating];
  const Icon = c.icon;
  return (
    <Badge className={`${c.className} text-xs flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
};

const generatePDF = async (inspection: Inspection, items: InspectionItem[]) => {
  // Build an HTML document and open in new tab for printing/saving as PDF
  const categories = [...new Set(items.map(i => i.category))];
  const greenCount = items.filter(i => i.rating === 'green').length;
  const yellowCount = items.filter(i => i.rating === 'yellow').length;
  const redCount = items.filter(i => i.rating === 'red').length;

  const ratingColor = inspection.overall_rating === 'green'
    ? '#16a34a' : inspection.overall_rating === 'yellow'
    ? '#ca8a04' : '#dc2626';

  const ratingLabel = inspection.overall_rating
    ? inspection.overall_rating.charAt(0).toUpperCase() + inspection.overall_rating.slice(1)
    : 'N/A';

  // Build photo HTML for each item
  const getPhotoHtml = (photos: InspectionPhoto[]) => {
    if (!photos || photos.length === 0) return '';
    const photoItems = photos.map(p => {
      const url = p.public_url || '';
      const caption = p.caption ? `<p style="font-size:11px;color:#666;margin:4px 0 0;">${p.caption}</p>` : '';
      return `<div style="display:inline-block;margin:4px;vertical-align:top;text-align:center;">
        <img src="${url}" style="width:180px;height:140px;object-fit:cover;border-radius:6px;border:1px solid #ddd;" />
        ${caption}
      </div>`;
    }).join('');
    return `<div style="margin-top:8px;">${photoItems}</div>`;
  };

  const categoryHtml = categories.map(cat => {
    const catItems = items.filter(i => i.category === cat);
    const rows = catItems.map(item => {
      const ratingColor = item.rating === 'green' ? '#16a34a' : item.rating === 'yellow' ? '#ca8a04' : item.rating === 'red' ? '#dc2626' : '#888';
      const ratingText = item.rating ? item.rating.charAt(0).toUpperCase() + item.rating.slice(1) : '—';
      return `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 12px;font-size:13px;">${item.item_name}</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${ratingColor};">${ratingText}</td>
          <td style="padding:8px 12px;font-size:12px;color:#555;">${item.notes || ''}</td>
        </tr>
        ${item.inspection_photos?.length > 0 ? `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td colspan="3" style="padding:4px 12px 12px;">
            ${getPhotoHtml(item.inspection_photos)}
          </td>
        </tr>` : ''}
      `;
    }).join('');

    return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:15px;font-weight:600;color:#1e293b;background:#f8fafc;padding:8px 12px;border-radius:6px;margin-bottom:0;">${cat}</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 12px;text-align:left;font-size:12px;color:#64748b;width:50%;">Item</th>
              <th style="padding:6px 12px;text-align:left;font-size:12px;color:#64748b;width:15%;">Rating</th>
              <th style="padding:6px 12px;text-align:left;font-size:12px;color:#64748b;width:35%;">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Inspection Report - ${inspection.job_sites.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #1e293b; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">
    <div>
      <h1 style="font-size:24px;font-weight:700;color:#ea580c;margin:0 0 4px;">CrewCompass</h1>
      <p style="font-size:13px;color:#64748b;margin:0;">Quality Inspection Report</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:12px;color:#64748b;margin:0;">Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}</p>
    </div>
  </div>

  <!-- Summary -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
    <div style="background:#f8fafc;border-radius:8px;padding:16px;">
      <p style="font-size:12px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Account</p>
      <p style="font-size:16px;font-weight:600;margin:0;">${inspection.job_sites.name}</p>
      ${inspection.job_sites.address ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0;">${inspection.job_sites.address}</p>` : ''}
    </div>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;">
      <p style="font-size:12px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Inspector</p>
      <p style="font-size:16px;font-weight:600;margin:0;">${inspection.profiles.first_name} ${inspection.profiles.last_name}</p>
      <p style="font-size:12px;color:#64748b;margin:4px 0 0;">${inspection.completed_at ? format(new Date(inspection.completed_at), 'MMM d, yyyy h:mm a') : ''}</p>
    </div>
  </div>

  <!-- Score Card -->
  <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;display:flex;align-items:center;gap:24px;">
    <div style="text-align:center;">
      <p style="font-size:40px;font-weight:700;color:${ratingColor};margin:0;">${inspection.overall_score?.toFixed(0) ?? '—'}%</p>
      <p style="font-size:14px;font-weight:600;color:${ratingColor};margin:0;">${ratingLabel}</p>
    </div>
    <div style="flex:1;">
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <span style="color:#16a34a;font-size:13px;font-weight:600;">✓ ${greenCount} Green</span>
        <span style="color:#ca8a04;font-size:13px;font-weight:600;">⚠ ${yellowCount} Yellow</span>
        <span style="color:#dc2626;font-size:13px;font-weight:600;">✗ ${redCount} Red</span>
        <span style="color:#64748b;font-size:13px;">${items.filter(i=>i.rating).length}/${items.length} items rated</span>
      </div>
      ${inspection.notes ? `<p style="font-size:13px;color:#475569;margin:8px 0 0;font-style:italic;">"${inspection.notes}"</p>` : ''}
    </div>
  </div>

  <!-- Checklist Details -->
  <h2 style="font-size:18px;font-weight:600;margin:0 0 16px;">Inspection Details</h2>
  ${categoryHtml}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#94a3b8;margin:0;">Generated by CrewCompass — Summit Facilities Group</p>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspection-${inspection.job_sites.name.replace(/\s+/g, '-')}-${format(new Date(inspection.completed_at || inspection.created_at), 'yyyy-MM-dd')}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

interface InspectionHistoryProps {
  employeeId?: string;
}

const InspectionHistory = ({ employeeId }: InspectionHistoryProps = {}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterSite, setFilterSite] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterWorker, setFilterWorker] = useState('all');
  const [jobSites, setJobSites] = useState<{ id: string; name: string }[]>([]);
  const [workers, setWorkers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchInspections();
    fetchJobSites();
    if (!employeeId) fetchWorkers();
  }, [employeeId]);

  const fetchJobSites = async () => {
    const { data } = await supabase.from('job_sites').select('id, name').eq('active', true).order('name');
    setJobSites(data || []);
  };

  const fetchWorkers = async () => {
    const { data } = await supabase
      .from('profiles_directory' as any)
      .select('id, first_name, last_name')
      .order('last_name');
    setWorkers((data as any) || []);
  };

  const fetchInspections = async () => {
    setLoading(true);
    let query = supabase
      .from('inspections')
      .select(`
        id, job_site_id, inspector_id, employee_id, status, overall_score, overall_rating,
        notes, completed_at, created_at,
        job_sites:job_site_id(name, address),
        profiles:inspector_id(first_name, last_name)
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;

    if (error) {
      toast({ title: 'Error', description: 'Failed to load inspections', variant: 'destructive' });
    } else {
      // Fetch worker names for the subject employees
      const rows = (data || []) as any[];
      const empIds = Array.from(new Set(rows.map(r => r.employee_id).filter(Boolean)));
      let empMap: Record<string, { first_name: string; last_name: string }> = {};
      if (empIds.length > 0) {
        const { data: emps } = await supabase
          .from('profiles_directory' as any)
          .select('id, first_name, last_name')
          .in('id', empIds);
        (emps as any[] || []).forEach(e => {
          empMap[e.id] = { first_name: e.first_name, last_name: e.last_name };
        });
      }
      setInspections(rows.map(r => ({ ...r, employee: r.employee_id ? empMap[r.employee_id] || null : null })) as Inspection[]);
    }
    setLoading(false);
  };

  const openDetail = async (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setLoadingDetail(true);
    const { data, error } = await supabase
      .from('inspection_items')
      .select(`
        id, category, item_name, rating, notes, sort_order,
        inspection_photos(id, public_url, storage_path, caption)
      `)
      .eq('inspection_id', inspection.id)
      .order('sort_order');

    if (!error) {
      // Refresh signed URLs for photos
      const itemsWithPhotos = await Promise.all((data || []).map(async (item: InspectionItem) => {
        const refreshedPhotos = await Promise.all((item.inspection_photos || []).map(async (photo) => {
          if (photo.storage_path) {
            const { data: signed } = await supabase.storage
              .from('inspection-photos')
              .createSignedUrl(photo.storage_path, 3600);
            return { ...photo, public_url: signed?.signedUrl || photo.public_url };
          }
          return photo;
        }));
        return { ...item, inspection_photos: refreshedPhotos };
      }));
      setInspectionItems(itemsWithPhotos as InspectionItem[]);
    }
    setLoadingDetail(false);
  };

  const filteredInspections = inspections.filter(i => {
    if (filterSite !== 'all' && i.job_site_id !== filterSite) return false;
    if (filterRating !== 'all' && i.overall_rating !== filterRating) return false;
    if (filterWorker !== 'all') {
      if (filterWorker === 'unassigned') { if (i.employee_id) return false; }
      else if (i.employee_id !== filterWorker) return false;
    }
    return true;
  });

  const categories = [...new Set(inspectionItems.map(i => i.category))];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterSite} onValueChange={setFilterSite}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {jobSites.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!employeeId && (
          <Select value={filterWorker} onValueChange={setFilterWorker}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All workers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workers</SelectItem>
              <SelectItem value="unassigned">— No worker assigned —</SelectItem>
              {workers.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.first_name} {w.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterRating} onValueChange={setFilterRating}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="green">Green</SelectItem>
            <SelectItem value="yellow">Yellow</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inspection List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading inspections...</p>
      ) : filteredInspections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No inspections yet</h3>
            <p className="text-sm text-muted-foreground">
              Click "Start an Inspection" to conduct your first quality inspection.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInspections.map(inspection => (
            <Card
              key={inspection.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail(inspection)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{inspection.job_sites?.name}</span>
                      <RatingBadge rating={inspection.overall_rating} />
                      {inspection.overall_score !== null && (
                        <span className="text-sm font-medium text-muted-foreground">
                          {inspection.overall_score.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Inspector: {inspection.profiles?.first_name} {inspection.profiles?.last_name}
                      </span>
                      {inspection.employee && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Worker: {inspection.employee.first_name} {inspection.employee.last_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {inspection.completed_at
                          ? format(new Date(inspection.completed_at), 'MMM d, yyyy h:mm a')
                          : format(new Date(inspection.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {inspection.notes && (
                      <p className="text-xs text-muted-foreground italic line-clamp-1">"{inspection.notes}"</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openDetail(inspection); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedInspection} onOpenChange={open => { if (!open) setSelectedInspection(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedInspection && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <DialogTitle>Inspection Report</DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generatePDF(selectedInspection, inspectionItems)}
                    className="mr-8"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Account</p>
                      <p className="font-semibold">{selectedInspection.job_sites?.name}</p>
                      {selectedInspection.job_sites?.address && (
                        <p className="text-xs text-muted-foreground">{selectedInspection.job_sites.address}</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Inspector</p>
                      <p className="font-semibold">
                        {selectedInspection.profiles?.first_name} {selectedInspection.profiles?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedInspection.completed_at
                          ? format(new Date(selectedInspection.completed_at), 'MMM d, yyyy h:mm a')
                          : ''}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Score */}
                <Card className={`border-2 ${
                  selectedInspection.overall_rating === 'green' ? 'border-green-400' :
                  selectedInspection.overall_rating === 'yellow' ? 'border-yellow-400' :
                  'border-red-400'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Overall Score</span>
                      <div className="flex items-center gap-2">
                        <RatingBadge rating={selectedInspection.overall_rating} />
                        <span className="text-2xl font-bold">
                          {selectedInspection.overall_score?.toFixed(0) ?? '—'}%
                        </span>
                      </div>
                    </div>
                    <Progress value={selectedInspection.overall_score ?? 0} className="h-2" />
                    {selectedInspection.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">"{selectedInspection.notes}"</p>
                    )}
                  </CardContent>
                </Card>

                {/* Items by category */}
                {loadingDetail ? (
                  <p className="text-center text-muted-foreground py-4">Loading details...</p>
                ) : (
                  categories.map(cat => {
                    const catItems = inspectionItems.filter(i => i.category === cat);
                    return (
                      <Card key={cat}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{cat}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                          {catItems.map(item => (
                            <div key={item.id}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm flex-1">{item.item_name}</span>
                                <RatingBadge rating={item.rating} />
                              </div>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-1 ml-2">{item.notes}</p>
                              )}
                              {item.inspection_photos?.length > 0 && (
                                <div className="flex gap-2 mt-2 ml-2 flex-wrap">
                                  {item.inspection_photos.map(photo => (
                                    <div key={photo.id} className="space-y-1">
                                      <img
                                        src={photo.public_url || ''}
                                        alt={photo.caption || 'Inspection photo'}
                                        className="h-20 w-28 object-cover rounded border"
                                      />
                                      {photo.caption && (
                                        <p className="text-xs text-muted-foreground">{photo.caption}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <Separator className="mt-2" />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InspectionHistory;
