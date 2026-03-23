'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUpload } from '@/components/ui/image-upload'
import { Checkbox } from '@/components/ui/checkbox'
import { User, Save, Loader2, Mail, Calendar, MapPin, DollarSign, Languages, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface UserProfile {
  user_id: string
  nick_name: string
  avatar_url?: string
  birth_year?: number
  travel_style?: string[]
  mobility?: 'walk' | 'bike' | 'public' | 'grab'
  budget_per_day?: number
  languages?: string[]
  onboarding_completed?: boolean
  onboarding_completed_at?: string
  onboarding_skipped_at?: string
  onboarding_preferences?: Record<string, any>
  updated_at: string
}

export default function ProfilePage() {
  const { user, getProfile, updateProfile, refreshProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    nick_name: '',
    avatar_url: '',
    birth_year: undefined as number | undefined,
    travel_style: [] as string[],
    mobility: 'public' as 'walk' | 'bike' | 'public' | 'grab',
    budget_per_day: undefined as number | undefined,
    languages: ['th'] as string[],
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (user && !authLoading) {
        try {
          const { profile: profileData, error } = await getProfile()
          if (error) {
            toast.error(`Failed to load profile: ${error}`)
          } else {
            setProfile(profileData)
            setFormData({
              nick_name: profileData?.nick_name || '',
              avatar_url: profileData?.avatar_url || '',
              birth_year: profileData?.birth_year || undefined,
              travel_style: profileData?.travel_style || [],
              mobility: profileData?.mobility || 'public',
              budget_per_day: profileData?.budget_per_day || 1500,
              languages: profileData?.languages || ['th'],
            })
          }
        } catch (error) {
          toast.error('An error occurred while loading profile')
        } finally {
          setLoading(false)
        }
      }
    }

    loadProfile()
  }, [user, authLoading, getProfile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseInt(value) : undefined) : value,
    }))
  }

  const handleCheckboxChange = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      travel_style: checked 
        ? [...prev.travel_style, value]
        : prev.travel_style.filter(item => item !== value)
    }))
  }

  const handleLanguageChange = (index: number, value: string) => {
    setFormData(prev => {
      const newLanguages = [...prev.languages]
      newLanguages[index] = value
      return { ...prev, languages: newLanguages }
    })
  }

  const handleImageUpload = (url: string) => {
    setFormData(prev => ({ ...prev, avatar_url: url }))
  }

  const handleImageRemove = () => {
    setFormData(prev => ({ ...prev, avatar_url: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const updates = {
        nick_name: formData.nick_name.trim() || undefined,
        avatar_url: formData.avatar_url || undefined,
        birth_year: formData.birth_year,
        travel_style: formData.travel_style.length > 0 ? formData.travel_style : undefined,
        mobility: formData.mobility,
        budget_per_day: formData.budget_per_day,
        languages: formData.languages.filter(lang => lang.trim() !== ''),
      }

      const { profile: updatedProfile, error } = await updateProfile(updates)
      
      if (error) {
        toast.error(`Failed to update profile: ${error}`)
      } else {
        setProfile(updatedProfile)
        // Update form data with the saved data to ensure consistency
        if (updatedProfile) {
          setFormData({
            nick_name: updatedProfile.nick_name || '',
            avatar_url: updatedProfile.avatar_url || '',
            birth_year: updatedProfile.birth_year || undefined,
            travel_style: updatedProfile.travel_style || [],
            mobility: updatedProfile.mobility || 'public',
            budget_per_day: updatedProfile.budget_per_day || 1500,
            languages: updatedProfile.languages || ['th'],
          })
        }
        // Immediately refresh the profile in auth context for AuthButton
        await refreshProfile()
        toast.success('Profile updated successfully!')
      }
    } catch (error) {
      toast.error('An error occurred while updating profile')
    } finally {
      setSaving(false)
    }
  }

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    )
  }

  // Show if not authenticated (shouldn't reach here due to redirect)
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Heart className="h-5 w-5 text-amber-500" />
                <span>Travel Survey</span>
              </CardTitle>
              <CardDescription>
                Personalize your recommendations with a quick survey.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {profile?.onboarding_completed
                    ? 'Survey completed. You can update your preferences anytime.'
                    : 'Survey not completed yet. Complete it to get better travel plans.'}
                </p>
              </div>
              <Button type="button" onClick={() => router.push('/onboarding')}>
                {profile?.onboarding_completed ? 'Edit Survey' : 'Complete Survey'}
              </Button>
            </CardContent>
          </Card>

          {/* Profile Picture & Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
              <CardDescription>
                Your basic information and profile picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile Picture */}
                <div className="flex justify-center lg:justify-start">
                  <ImageUpload
                    currentImageUrl={formData.avatar_url}
                    onImageUpload={handleImageUpload}
                    onImageRemove={handleImageRemove}
                    disabled={saving}
                    size="lg"
                  />
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>Email Address</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={user.email || ''}
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-sm text-gray-600">
                      Email cannot be changed.
                    </p>
                  </div>

                  {/* Nickname */}
                  <div className="space-y-2">
                    <Label htmlFor="nick_name" className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>Display Name *</span>
                    </Label>
                    <Input
                      id="nick_name"
                      name="nick_name"
                      type="text"
                      value={formData.nick_name}
                      onChange={handleInputChange}
                      placeholder="Enter your display name"
                      required
                    />
                    <p className="text-sm text-gray-600">
                      This name will be visible to other travelers.
                    </p>
                  </div>

                  {/* Birth Year */}
                  <div className="space-y-2">
                    <Label htmlFor="birth_year" className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Birth Year</span>
                    </Label>
                    <Input
                      id="birth_year"
                      name="birth_year"
                      type="number"
                      min="1900"
                      max="2010"
                      value={formData.birth_year || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 1990"
                    />
                    <p className="text-sm text-gray-600">
                      Optional. Helps provide age-appropriate recommendations.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Travel Preferences */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Travel Style */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  <span>Travel Style</span>
                </CardTitle>
                <CardDescription>
                  What kind of traveler are you?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { value: 'slow-life', label: 'Slow Life', desc: 'Relaxed, peaceful travel' },
                    { value: 'budget', label: 'Budget', desc: 'Cost-conscious adventures' },
                    { value: 'instagram', label: 'Instagram', desc: 'Photo-worthy destinations' },
                    { value: 'foodie', label: 'Foodie', desc: 'Culinary experiences' },
                    { value: 'history', label: 'History', desc: 'Cultural & historical sites' }
                  ].map((style) => (
                    <div key={style.value} className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50">
                      <Checkbox
                        id={style.value}
                        checked={formData.travel_style.includes(style.value)}
                        onCheckedChange={(checked) => handleCheckboxChange(style.value, checked as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor={style.value} className="text-sm font-medium cursor-pointer">
                          {style.label}
                        </label>
                        <p className="text-xs text-gray-600">{style.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Transportation & Budget */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-green-500" />
                  <span>Travel Preferences</span>
                </CardTitle>
                <CardDescription>
                  How you like to get around
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mobility */}
                <div className="space-y-2">
                  <Label htmlFor="mobility" className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>Preferred Transportation</span>
                  </Label>
                  <select
                    id="mobility"
                    name="mobility"
                    value={formData.mobility}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="walk">🚶 Walking</option>
                    <option value="bike">🚴 Bicycle</option>
                    <option value="public">🚌 Public Transport</option>
                    <option value="grab">🚗 Grab/Taxi</option>
                  </select>
                </div>

                {/* Budget */}
                <div className="space-y-2">
                  <Label htmlFor="budget_per_day" className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Daily Budget (THB)</span>
                  </Label>
                  <Input
                    id="budget_per_day"
                    name="budget_per_day"
                    type="number"
                    min="0"
                    step="100"
                    value={formData.budget_per_day || ''}
                    onChange={handleInputChange}
                    placeholder="1500"
                  />
                  <p className="text-sm text-gray-600">
                    Your approximate daily spending in Thai Baht.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>          {/* Languages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Languages className="h-5 w-5 text-purple-500" />
                <span>Languages</span>
              </CardTitle>
              <CardDescription>
                Languages you speak (helps connect with locals and other travelers)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {formData.languages.map((lang, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      type="text"
                      value={lang}
                      onChange={(e) => handleLanguageChange(index, e.target.value)}
                      placeholder="e.g., th, en, zh"
                    />
                    {formData.languages.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            languages: prev.languages.filter((_, i) => i !== index)
                          }))
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, languages: [...prev.languages, ''] }))}
                >
                  + Add Language
                </Button>
                <p className="text-sm text-gray-600">
                  Use language codes like 'th' (Thai), 'en' (English), 'zh' (Chinese).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={saving}
              className="min-w-[150px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}