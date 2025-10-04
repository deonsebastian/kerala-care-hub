import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, AlertCircle, Package, Users } from "lucide-react";
import { toast } from "sonner";

interface Camp {
  id: string;
  name: string;
  location: string;
  total_capacity: number;
  occupied_seats: number;
  contact_phone: string;
}

interface Need {
  id: string;
  item_name: string;
  quantity_needed: number;
  quantity_fulfilled: number;
  urgency: string;
  status: string;
}

interface CampDashboardProps {
  onSignOut: () => void;
}

const CampDashboard = ({ onSignOut }: CampDashboardProps) => {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [showCampDialog, setShowCampDialog] = useState(false);
  const [showNeedDialog, setShowNeedDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampData();
  }, []);

  const fetchCampData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: campsData, error: campsError } = await supabase
        .from("camps")
        .select("*")
        .eq("camp_admin_id", user.id)
        .order("created_at", { ascending: false });

      if (campsError) throw campsError;

      setCamps(campsData || []);
      
      // If there are camps and no selected camp, select the first one
      if (campsData && campsData.length > 0 && !selectedCamp) {
        setSelectedCamp(campsData[0]);
        await fetchNeeds(campsData[0].id);
      }
    } catch (error) {
      console.error("Error fetching camp data:", error);
      toast.error("Failed to load camp data");
    } finally {
      setLoading(false);
    }
  };

  const fetchNeeds = async (campId: string) => {
    const { data, error } = await supabase
      .from("camp_needs")
      .select("*")
      .eq("camp_id", campId)
      .order("urgency", { ascending: false });

    if (error) {
      console.error("Error fetching needs:", error);
    } else {
      setNeeds(data || []);
    }
  };

  const handleCreateCamp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("camps")
        .insert({
          camp_admin_id: user.id,
          name: formData.get("name") as string,
          location: formData.get("location") as string,
          total_capacity: parseInt(formData.get("capacity") as string),
          occupied_seats: parseInt(formData.get("occupied") as string),
          contact_phone: formData.get("phone") as string,
          contact_email: formData.get("email") as string,
        })
        .select()
        .single();

      if (error) throw error;

      setCamps(prev => [data, ...prev]);
      setSelectedCamp(data);
      setShowCampDialog(false);
      toast.success("Camp created successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create camp");
    }
  };

  const handleAddNeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCamp) return;

    const formData = new FormData(e.currentTarget);

    try {
      const { error } = await supabase.from("camp_needs").insert({
        camp_id: selectedCamp.id,
        item_name: formData.get("item") as string,
        quantity_needed: parseInt(formData.get("quantity") as string),
        urgency: formData.get("urgency") as string,
      });

      if (error) throw error;

      await fetchNeeds(selectedCamp.id);
      setShowNeedDialog(false);
      toast.success("Need added successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add need");
    }
  };

  const handleCampSelect = async (camp: Camp) => {
    setSelectedCamp(camp);
    await fetchNeeds(camp.id);
  };

  const urgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical": return "destructive";
      case "high": return "warning";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (camps.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Camp Management</h1>
          <Button variant="outline" onClick={onSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Camp Registered</h2>
            <p className="text-muted-foreground mb-6">
              Create your relief camp to start managing capacity and needs
            </p>
            <Dialog open={showCampDialog} onOpenChange={setShowCampDialog}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Camp
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Relief Camp</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCamp} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Camp Name</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" name="location" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="capacity">Total Capacity</Label>
                      <Input id="capacity" name="capacity" type="number" required />
                    </div>
                    <div>
                      <Label htmlFor="occupied">Occupied Seats</Label>
                      <Input id="occupied" name="occupied" type="number" defaultValue="0" required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Contact Phone</Label>
                    <Input id="phone" name="phone" type="tel" required />
                  </div>
                  <div>
                    <Label htmlFor="email">Contact Email (Optional)</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                  <Button type="submit" className="w-full">Create Camp</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedCamp) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Camp Management</h1>
          <Button variant="outline" onClick={onSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No camp selected</p>
        </div>
      </div>
    );
  }

  const availableSeats = selectedCamp.total_capacity - selectedCamp.occupied_seats;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{selectedCamp.name}</h1>
          <p className="text-muted-foreground">{selectedCamp.location}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCampDialog} onOpenChange={setShowCampDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Camp
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Relief Camp</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCamp} className="space-y-4">
                <div>
                  <Label htmlFor="name">Camp Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" name="location" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="capacity">Total Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" required />
                  </div>
                  <div>
                    <Label htmlFor="occupied">Occupied Seats</Label>
                    <Input id="occupied" name="occupied" type="number" defaultValue="0" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Contact Phone</Label>
                  <Input id="phone" name="phone" type="tel" required />
                </div>
                <div>
                  <Label htmlFor="email">Contact Email (Optional)</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <Button type="submit" className="w-full">Create Camp</Button>
              </form>
            </DialogContent>
          </Dialog>
          {camps.length > 1 && (
            <Select value={selectedCamp.id} onValueChange={(campId) => {
              const camp = camps.find(c => c.id === campId);
              if (camp) handleCampSelect(camp);
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select camp" />
              </SelectTrigger>
              <SelectContent>
                {camps.map((camp) => (
                  <SelectItem key={camp.id} value={camp.id}>
                    {camp.name} - {camp.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={onSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedCamp.total_capacity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedCamp.occupied_seats}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{availableSeats}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Camp Needs</CardTitle>
            <Dialog open={showNeedDialog} onOpenChange={setShowNeedDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Need
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Item Need</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddNeed} className="space-y-4">
                  <div>
                    <Label htmlFor="item">Item Name</Label>
                    <Input id="item" name="item" required />
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity Needed</Label>
                    <Input id="quantity" name="quantity" type="number" required />
                  </div>
                  <div>
                    <Label htmlFor="urgency">Urgency Level</Label>
                    <Select name="urgency" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Add Need</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {needs.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No needs listed yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {needs.map((need) => (
                <div key={need.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{need.item_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {need.quantity_fulfilled} / {need.quantity_needed} fulfilled
                    </div>
                  </div>
                  <Badge variant={urgencyColor(need.urgency) as any}>
                    {need.urgency}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CampDashboard;