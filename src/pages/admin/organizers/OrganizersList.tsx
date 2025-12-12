import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { Plus, Edit, Trash2, Mail, Phone } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { Organizer } from '@/types';
import { useAdmin } from '@/hooks';

export const OrganizersList: FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<Organizer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const { listOrganizers, deleteOrganizer } = useAdmin();

  const fetchOrganizers = async () => {
    setIsLoading(true);
    try {
      const data = await listOrganizers({
        sorters: [{ field: 'display_order', order: 'asc' }],
      });
      setOrganizers(data);
    } catch (error) {
      console.error('Error fetching organizers:', error);
      alert('Failed to load organizers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizers();
  }, []);

  const handleDelete = (org: Organizer) => {
    setDeleteItem(org);
    setDeleteId(org.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteOrganizer(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      alert('Organizer deleted successfully!');
      await fetchOrganizers();
    } catch (error) {
      setIsDeleting(false);
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete organizer: ${errorMessage}. Check the browser console for details.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Organizers</h1>
          <p className="text-white/80 mt-2">Manage event organizer profiles</p>
        </div>
        <Link to="/organizers/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Organizer
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">Loading...</div>
          </CardContent>
        </Card>
      ) : organizers.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">No organizers found.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organizers.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg font-viking text-white">{org.name}</CardTitle>
                <Badge variant="secondary">{org.role}</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {org.photoUrl && (
                    <img
                      src={org.photoUrl}
                      alt={org.name}
                      className="w-full h-48 object-cover rounded"
                    />
                  )}
                  {org.bio && (
                    <p className="text-sm text-white/70 line-clamp-2">{org.bio}</p>
                  )}
                  {org.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-orange-500" />
                      <span className="text-white/90 truncate">{org.email}</span>
                    </div>
                  )}
                  {org.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-orange-500" />
                      <span className="text-white/90">{org.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                    <Link to={`/organizers/edit/${org.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(org)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteItem(null);
          }
        }}
        onConfirm={confirmDelete}
        itemName={deleteItem?.name || ''}
        itemType="Organizer"
        isLoading={isDeleting}
      />
    </div>
  );
};
