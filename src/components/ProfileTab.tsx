import { User, Mail, Phone, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const ProfileTab = () => {
  const { user } = useAuth();
  const { profile, role, isLoading, updateProfile, isUpdating } = useProfile();
  
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    email: '',
  });

  const [errors, setErrors] = useState({
    email: '',
    phone: '',
    full_name: '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: profile?.full_name || user.user_metadata?.full_name || '',
        phone: profile?.phone || '',
        email: user.email || '',
      });
    }
  }, [profile, user]);

  const validateForm = () => {
    const newErrors = { email: '', phone: '', full_name: '' };
    
    if (!profileForm.full_name.trim()) {
      newErrors.full_name = 'Name is required';
    }
    
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (profileForm.phone && !/^[\d\s\-\+\(\)]{8,}$/.test(profileForm.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    updateProfile(profileForm);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Full Name
            </Label>
            <Input 
              id="fullName" 
              value={profileForm.full_name}
              onChange={(e) => {
                setProfileForm(prev => ({ ...prev, full_name: e.target.value }));
                if (errors.full_name) setErrors(prev => ({ ...prev, full_name: '' }));
              }}
              placeholder="Enter your full name"
              className={errors.full_name ? "border-destructive" : ""}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input 
              id="email" 
              type="email" 
              value={profileForm.email}
              onChange={(e) => {
                setProfileForm(prev => ({ ...prev, email: e.target.value }));
                if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="Your email address"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone
            </Label>
            <Input 
              id="phone" 
              value={profileForm.phone}
              onChange={(e) => {
                setProfileForm(prev => ({ ...prev, phone: e.target.value }));
                if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
              }}
              placeholder="Enter your phone number"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              User Role
            </Label>
            <div className="flex items-center h-10 px-3 py-2">
              <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                {role}
              </Badge>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={handleSubmit} 
          disabled={isUpdating || !profileForm.full_name.trim()}
          className="w-full sm:w-auto"
        >
          {isUpdating ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
};