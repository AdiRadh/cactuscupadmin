import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Plus, Edit, Trash2, Globe, Star } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { GuestInstructor } from '@/types';
import { useAdmin } from '@/hooks';

/**
 * Admin guest instructors list page
 */
export const GuestInstructorsList: FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<GuestInstructor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [instructors, setInstructors] = useState<GuestInstructor[]>([]);
  const { listGuestInstructors, deleteGuestInstructor } = useAdmin();

  const fetchInstructors = async () => {
    setIsLoading(true);
    try {
      const data = await listGuestInstructors({
        sorters: [{ field: 'display_order', order: 'asc' }],
      });
      setInstructors(data);
    } catch (error) {
      console.error('Error fetching guest instructors:', error);
      alert('Failed to load guest instructors.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructors();
  }, []);

  const handleDelete = (instructor: GuestInstructor) => {
    setDeleteItem(instructor);
    setDeleteId(instructor.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteGuestInstructor(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      alert('Guest instructor deleted successfully!');
      await fetchInstructors();
    } catch (error) {
      setIsDeleting(false);
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete guest instructor: ${errorMessage}. Check the browser console for details.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Guest Instructors</h1>
          <p className="text-white/80 mt-2">
            Manage guest instructor profiles and information
          </p>
        </div>
        <Link to="/guest-instructors/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Guest Instructor
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">
              Loading guest instructors...
            </div>
          </CardContent>
        </Card>
      ) : instructors.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-white">
              No guest instructors found. Add your first instructor to get started.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {instructors.map((instructor) => (
            <Card key={instructor.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-viking text-white">
                      {instructor.name}
                    </CardTitle>
                    <div className="flex gap-2 mt-2">
                      {instructor.isFeatured && (
                        <Badge variant="default">
                          <Star className="h-3 w-3 mr-1" />
                          Featured Instructor
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {instructor.photoUrl && (
                    <img
                      src={instructor.photoUrl}
                      alt={instructor.name}
                      className="w-full h-48 object-cover rounded"
                    />
                  )}

                  <p className="text-sm text-white/70 line-clamp-3">
                    {instructor.bio}
                  </p>

                  {instructor.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {instructor.specialties.slice(0, 3).map((specialty, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {instructor.websiteUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-orange-500" />
                      <a
                        href={instructor.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/90 hover:underline truncate"
                      >
                        Website
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                    <Link to={`/guest-instructors/edit/${instructor.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(instructor)}
                    >
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
        itemType="Guest Instructor"
        isLoading={isDeleting}
      />
    </div>
  );
};
