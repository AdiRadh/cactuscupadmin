import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, NativeSelect, Button } from '@/components/ui';
import type { SpecialEvent, SpecialEventStatus } from '@/types';
import { ImageUpload } from './ImageUpload';
import { utcToDatetimeLocal, formatDateTime } from '@/lib/utils/dateUtils';

export interface SpecialEventFormData {
  // Hero Section
  title: string;
  slug: string;
  subtitle: string;
  heroSubtitle: string;
  navDisplayName: string;
  heroImageUrl: string | null;

  // Basic Info
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  location: string;

  // Location Details
  address: string;
  city: string;
  state: string;
  zipCode: string;
  directionsText: string;
  parkingInfo: string;

  // Itinerary (simplified as JSON for now)
  itineraryJson: string;

  // Dress Code
  dressCode: string;
  dressCodeDetails: string;

  // Pricing (in dollars, will be converted to cents)
  ticketPrice: number;
  eventRegistrantPrice: number | null;
  earlyBirdTicketPrice: number | null; // in dollars (converted to/from cents)
  earlyBirdStartDate: string;
  earlyBirdEndDate: string;
  allowNonRegistrants: boolean;
  allowStandalonePurchase: boolean;

  // Register Button (optional)
  registerButtonText: string;
  registerButtonUrl: string;

  // Settings
  maxCapacity: number | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  isActive: boolean;
  status: SpecialEventStatus;
  visible: boolean;
}

interface SpecialEventFormProps {
  initialData?: SpecialEvent;
  onSubmit: (data: SpecialEventFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
  onImageUpload: (file: File) => Promise<{ url: string } | { error: string }>;
  onImageDelete: (url: string) => Promise<void>;
}

const DRESS_CODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Not Specified' },
  { value: 'Formal', label: 'Formal' },
  { value: 'Semi-Formal', label: 'Semi-Formal' },
  { value: 'Cocktail Attire', label: 'Cocktail Attire' },
  { value: 'Business Casual', label: 'Business Casual' },
  { value: 'Casual', label: 'Casual' },
];

const STATUS_OPTIONS: { value: SpecialEventStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Reusable special event form component
 * Used for both creating and editing special events
 */
export const SpecialEventForm: FC<SpecialEventFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Special Event',
  onImageUpload,
  onImageDelete,
}) => {
  const [formData, setFormData] = useState<SpecialEventFormData>({
    // Hero Section
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    subtitle: initialData?.subtitle || '',
    heroSubtitle: initialData?.heroSubtitle || '',
    navDisplayName: initialData?.navDisplayName || 'Special Event',
    heroImageUrl: initialData?.heroImageUrl || null,

    // Basic Info
    description: initialData?.description || '',
    date: initialData?.date || '',
    startTime: initialData?.startTime || '',
    endTime: initialData?.endTime || '',
    venue: initialData?.venue || '',
    location: initialData?.location || '',

    // Location Details
    address: initialData?.locationDetails?.address || '',
    city: initialData?.locationDetails?.city || '',
    state: initialData?.locationDetails?.state || '',
    zipCode: initialData?.locationDetails?.zipCode || '',
    directionsText: initialData?.directionsText || '',
    parkingInfo: initialData?.parkingInfo || '',

    // Itinerary (convert from array to JSON string)
    itineraryJson: initialData?.itinerary ? JSON.stringify(initialData.itinerary, null, 2) : '',

    // Dress Code
    dressCode: initialData?.dressCode || '',
    dressCodeDetails: initialData?.dressCodeDetails || '',

    // Pricing (convert cents to dollars)
    ticketPrice: initialData ? initialData.ticketPrice / 100 : 0,
    eventRegistrantPrice: initialData?.eventRegistrantPrice !== null && initialData?.eventRegistrantPrice !== undefined
      ? initialData.eventRegistrantPrice / 100
      : null,
    earlyBirdTicketPrice: initialData?.earlyBirdTicketPrice ? initialData.earlyBirdTicketPrice / 100 : null, // Convert cents to dollars
    earlyBirdStartDate: utcToDatetimeLocal(initialData?.earlyBirdStartDate),
    earlyBirdEndDate: utcToDatetimeLocal(initialData?.earlyBirdEndDate),
    allowNonRegistrants: initialData?.allowNonRegistrants ?? true,
    allowStandalonePurchase: initialData?.allowStandalonePurchase ?? true,

    // Register Button (optional)
    registerButtonText: initialData?.registerButtonText || '',
    registerButtonUrl: initialData?.registerButtonUrl || '',

    // Settings
    maxCapacity: initialData?.maxCapacity || null,
    registrationOpensAt: utcToDatetimeLocal(initialData?.registrationOpensAt),
    registrationClosesAt: utcToDatetimeLocal(initialData?.registrationClosesAt),
    isActive: initialData?.isActive ?? false,
    status: initialData?.status || 'draft',
    visible: initialData?.visible ?? true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SpecialEventFormData, string>>>({});

  // Auto-generate slug from title
  useEffect(() => {
    if (!initialData && formData.title) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  }, [formData.title, initialData]);

  const handleChange = (
    field: keyof SpecialEventFormData,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof SpecialEventFormData, string>> = {};

    // Hero Section validation
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required';
    if (!formData.navDisplayName.trim()) newErrors.navDisplayName = 'Nav Display Name is required';

    // Basic Info validation
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.venue.trim()) newErrors.venue = 'Venue is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';

    // Pricing validation
    if (formData.ticketPrice < 0) newErrors.ticketPrice = 'Ticket price cannot be negative';
    if (formData.eventRegistrantPrice !== null && formData.eventRegistrantPrice < 0) {
      newErrors.eventRegistrantPrice = 'Price cannot be negative';
    }

    // Validate early bird pricing
    if (formData.earlyBirdTicketPrice !== null) {
      if (formData.earlyBirdTicketPrice >= formData.ticketPrice) {
        newErrors.earlyBirdTicketPrice = 'Early bird price must be less than regular price';
      }
      if (!formData.earlyBirdStartDate) {
        newErrors.earlyBirdStartDate = 'Start date required when early bird price is set';
      }
      if (!formData.earlyBirdEndDate) {
        newErrors.earlyBirdEndDate = 'End date required when early bird price is set';
      }
      if (formData.earlyBirdStartDate && formData.earlyBirdEndDate) {
        const start = new Date(formData.earlyBirdStartDate);
        const end = new Date(formData.earlyBirdEndDate);
        if (start >= end) {
          newErrors.earlyBirdEndDate = 'End date must be after start date';
        }
      }
    }

    // Itinerary JSON validation
    if (formData.itineraryJson.trim()) {
      try {
        const parsed = JSON.parse(formData.itineraryJson);
        if (!Array.isArray(parsed)) {
          newErrors.itineraryJson = 'Itinerary must be a JSON array';
        }
      } catch (e) {
        newErrors.itineraryJson = 'Invalid JSON format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Gala Dinner"
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-sm text-red-600 mt-1">{errors.title}</p>
              )}
            </div>

            <div>
              <Label htmlFor="slug">
                URL Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                placeholder="gala-dinner"
                className={errors.slug ? 'border-red-500' : ''}
              />
              {errors.slug && (
                <p className="text-sm text-red-600 mt-1">{errors.slug}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={formData.subtitle}
                onChange={(e) => handleChange('subtitle', e.target.value)}
                placeholder="Brief subtitle"
              />
            </div>

            <div>
              <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
              <Input
                id="heroSubtitle"
                value={formData.heroSubtitle}
                onChange={(e) => handleChange('heroSubtitle', e.target.value)}
                placeholder="Hero section subtitle"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="navDisplayName">
              Nav Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="navDisplayName"
              value={formData.navDisplayName}
              onChange={(e) => handleChange('navDisplayName', e.target.value)}
              placeholder="Special Event"
              className={errors.navDisplayName ? 'border-red-500' : ''}
            />
            {errors.navDisplayName && (
              <p className="text-sm text-red-600 mt-1">{errors.navDisplayName}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              This is what appears in the navigation bar
            </p>
          </div>

          <ImageUpload
            label="Hero Image"
            value={formData.heroImageUrl}
            onChange={(url) => handleChange('heroImageUrl', url || '')}
            onUpload={onImageUpload}
            onDelete={onImageDelete}
            helperText="Recommended size: 1920x600px. This image will be displayed in the hero section."
          />
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Detailed description of the event..."
              rows={4}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="date">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className={errors.date ? 'border-red-500' : ''}
              />
              {errors.date && (
                <p className="text-sm text-red-600 mt-1">{errors.date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleChange('endTime', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="venue">
                Venue <span className="text-red-500">*</span>
              </Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => handleChange('venue', e.target.value)}
                placeholder="e.g., Grand Ballroom"
                className={errors.venue ? 'border-red-500' : ''}
              />
              {errors.venue && (
                <p className="text-sm text-red-600 mt-1">{errors.venue}</p>
              )}
            </div>

            <div>
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g., Phoenix Convention Center"
                className={errors.location ? 'border-red-500' : ''}
              />
              {errors.location && (
                <p className="text-sm text-red-600 mt-1">{errors.location}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Details */}
      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="123 Main Street"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Phoenix"
              />
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="AZ"
                maxLength={2}
              />
            </div>

            <div>
              <Label htmlFor="zipCode">Zip Code</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => handleChange('zipCode', e.target.value)}
                placeholder="85001"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="directionsText">Directions</Label>
            <Textarea
              id="directionsText"
              value={formData.directionsText}
              onChange={(e) => handleChange('directionsText', e.target.value)}
              placeholder="Detailed directions to the venue..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="parkingInfo">Parking Information</Label>
            <Textarea
              id="parkingInfo"
              value={formData.parkingInfo}
              onChange={(e) => handleChange('parkingInfo', e.target.value)}
              placeholder="Parking instructions and details..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Itinerary */}
      <Card>
        <CardHeader>
          <CardTitle>Itinerary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="itineraryJson">Itinerary JSON</Label>
            <Textarea
              id="itineraryJson"
              value={formData.itineraryJson}
              onChange={(e) => handleChange('itineraryJson', e.target.value)}
              placeholder='[{"id": "1", "time": "7:00 PM", "title": "Cocktail Hour", "description": "Welcome reception"}]'
              rows={8}
              className={`font-mono text-sm ${errors.itineraryJson ? 'border-red-500' : ''}`}
            />
            {errors.itineraryJson && (
              <p className="text-sm text-red-600 mt-1">{errors.itineraryJson}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Enter itinerary as a JSON array. Each item should have: id, time, title, description, and optional icon.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dress Code */}
      <Card>
        <CardHeader>
          <CardTitle>Dress Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="dressCode">Dress Code</Label>
            <NativeSelect
              id="dressCode"
              value={formData.dressCode}
              onChange={(e) => handleChange('dressCode', e.target.value)}
              options={DRESS_CODE_OPTIONS}
            />
          </div>

          <div>
            <Label htmlFor="dressCodeDetails">Dress Code Details</Label>
            <Textarea
              id="dressCodeDetails"
              value={formData.dressCodeDetails}
              onChange={(e) => handleChange('dressCodeDetails', e.target.value)}
              placeholder="Additional dress code information and guidelines..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ticketPrice">Ticket Price ($)</Label>
              <Input
                id="ticketPrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.ticketPrice}
                onChange={(e) => handleChange('ticketPrice', parseFloat(e.target.value) || 0)}
                className={errors.ticketPrice ? 'border-red-500' : ''}
              />
              {errors.ticketPrice && (
                <p className="text-sm text-red-600 mt-1">{errors.ticketPrice}</p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                Base ticket price in dollars
              </p>
            </div>

            <div>
              <Label htmlFor="eventRegistrantPrice">Event Registrant Price ($)</Label>
              <Input
                id="eventRegistrantPrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.eventRegistrantPrice ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? null : parseFloat(e.target.value);
                  handleChange('eventRegistrantPrice', value);
                }}
                className={errors.eventRegistrantPrice ? 'border-red-500' : ''}
              />
              {errors.eventRegistrantPrice && (
                <p className="text-sm text-red-600 mt-1">{errors.eventRegistrantPrice}</p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                Leave empty for free admission for event registrants
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="allowNonRegistrants"
              type="checkbox"
              checked={formData.allowNonRegistrants}
              onChange={(e) => handleChange('allowNonRegistrants', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="allowNonRegistrants" className="cursor-pointer">
              Allow non-registrants to purchase tickets
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="allowStandalonePurchase"
              type="checkbox"
              checked={formData.allowStandalonePurchase}
              onChange={(e) => handleChange('allowStandalonePurchase', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="allowStandalonePurchase" className="cursor-pointer">
              Allow standalone ticket purchase
            </Label>
          </div>
          <p className="text-sm text-gray-400 -mt-2 ml-7">
            When disabled, users will be redirected to the event registration flow instead of buying tickets directly.
          </p>
        </CardContent>
      </Card>

      {/* Early Bird Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Early Bird Pricing (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Set a discounted ticket price available during a specific time period.
              Leave fields empty to disable early bird pricing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="earlyBirdTicketPrice">Early Bird Price ($)</Label>
              <Input
                id="earlyBirdTicketPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.earlyBirdTicketPrice ?? ''}
                onChange={(e) => handleChange('earlyBirdTicketPrice', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 45.00"
                className={errors.earlyBirdTicketPrice ? 'border-red-500' : ''}
              />
              {errors.earlyBirdTicketPrice && (
                <p className="text-sm text-red-600 mt-1">{errors.earlyBirdTicketPrice}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Must be less than regular price (${formData.ticketPrice})
              </p>
            </div>

            <div>
              <Label htmlFor="earlyBirdStartDate">Start Date</Label>
              <Input
                id="earlyBirdStartDate"
                type="datetime-local"
                value={formData.earlyBirdStartDate}
                onChange={(e) => handleChange('earlyBirdStartDate', e.target.value)}
                className={errors.earlyBirdStartDate ? 'border-red-500' : ''}
              />
              {errors.earlyBirdStartDate && (
                <p className="text-sm text-red-600 mt-1">{errors.earlyBirdStartDate}</p>
              )}
            </div>

            <div>
              <Label htmlFor="earlyBirdEndDate">End Date</Label>
              <Input
                id="earlyBirdEndDate"
                type="datetime-local"
                value={formData.earlyBirdEndDate}
                onChange={(e) => handleChange('earlyBirdEndDate', e.target.value)}
                className={errors.earlyBirdEndDate ? 'border-red-500' : ''}
              />
              {errors.earlyBirdEndDate && (
                <p className="text-sm text-red-600 mt-1">{errors.earlyBirdEndDate}</p>
              )}
            </div>
          </div>

          {formData.earlyBirdTicketPrice && formData.earlyBirdStartDate && formData.earlyBirdEndDate && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-800">
                Early bird price of <strong>${formData.earlyBirdTicketPrice}</strong> will be available from{' '}
                {formatDateTime(formData.earlyBirdStartDate + 'Z')} to{' '}
                {formatDateTime(formData.earlyBirdEndDate + 'Z')} (Arizona Time)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register Button */}
      <Card>
        <CardHeader>
          <CardTitle>Register Button (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">
              Add an optional register button to the hero section. Leave both fields empty to hide the button.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="registerButtonText">Button Text</Label>
              <Input
                id="registerButtonText"
                value={formData.registerButtonText}
                onChange={(e) => handleChange('registerButtonText', e.target.value)}
                placeholder="e.g., Register Now"
              />
            </div>

            <div>
              <Label htmlFor="registerButtonUrl">Button URL</Label>
              <Input
                id="registerButtonUrl"
                value={formData.registerButtonUrl}
                onChange={(e) => handleChange('registerButtonUrl', e.target.value)}
                placeholder="e.g., https://example.com/register"
              />
            </div>
          </div>

          {formData.registerButtonText && formData.registerButtonUrl && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-800">
                A button with text "<strong>{formData.registerButtonText}</strong>" will link to{' '}
                <a href={formData.registerButtonUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {formData.registerButtonUrl}
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="maxCapacity">Maximum Capacity</Label>
            <Input
              id="maxCapacity"
              type="number"
              min="1"
              value={formData.maxCapacity ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? null : parseInt(e.target.value);
                handleChange('maxCapacity', value);
              }}
              placeholder="Leave empty for unlimited"
            />
            <p className="text-sm text-gray-600 mt-1">
              Maximum number of attendees (leave empty for no limit)
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="registrationOpensAt">Registration Opens At</Label>
              <Input
                id="registrationOpensAt"
                type="datetime-local"
                value={formData.registrationOpensAt}
                onChange={(e) => handleChange('registrationOpensAt', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="registrationClosesAt">Registration Closes At</Label>
              <Input
                id="registrationClosesAt"
                type="datetime-local"
                value={formData.registrationClosesAt}
                onChange={(e) => handleChange('registrationClosesAt', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <NativeSelect
              id="status"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value as SpecialEventStatus)}
              options={STATUS_OPTIONS}
            />
            <p className="text-sm text-gray-400 mt-1">
              Draft events are only visible in admin. Published events can be seen by users.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Set as Active Event (appears in navigation)
            </Label>
          </div>
          <p className="text-sm text-gray-400 -mt-2 ml-7">
            Multiple events can be active simultaneously. Active events appear in navigation and are visible to users.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="visible"
              type="checkbox"
              checked={formData.visible}
              onChange={(e) => handleChange('visible', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="visible" className="cursor-pointer">
              Visible on public site
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitText}
        </Button>
      </div>
    </form>
  );
};
