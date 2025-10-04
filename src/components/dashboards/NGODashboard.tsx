import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Package, MapPin, AlertCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Camp {
  id: string;
  name: string;
  location: string;
  total_capacity: number;
  occupied_seats: number;
}

interface Need {
  id: string;
  camp_id: string;
  item_name: string;
  quantity_needed: number;
  quantity_fulfilled: number;
  urgency: string;
  camps: {
    name: string;
    location: string;
  };
}

interface NGODashboardProps {
  onSignOut: () => void;
}

const NGODashboard = ({ onSignOut }: NGODashboardProps) => {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);
  const [showAssistDialog, setShowAssistDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campsResult, needsResult] = await Promise.all([
        supabase.from("camps").select("*").eq("status", "active"),
        supabase
          .from("camp_needs")
          .select(`
            *,
            camps (
              name,
              location
            )
          `)
          .neq("status", "fulfilled")
          .order("urgency", { ascending: false }),
      ]);

      if (campsResult.error) throw campsResult.error;
      if (needsResult.error) throw needsResult.error;

      setCamps(campsResult.data || []);
      setNeeds(needsResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleProvideAssistance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedNeed) return;

    const formData = new FormData(e.currentTarget);
    const quantity = parseInt(formData.get("quantity") as string);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("ngo_assistance").insert({
        ngo_id: user.id,
        camp_id: selectedNeed.camp_id,
        need_id: selectedNeed.id,
        items_provided: selectedNeed.item_name,
        quantity: quantity,
        notes: formData.get("notes") as string,
      });

      if (error) throw error;

      // Update the need
      const newFulfilled = selectedNeed.quantity_fulfilled + quantity;
      const newStatus = newFulfilled >= selectedNeed.quantity_needed ? "fulfilled" : "partial";

      await supabase
        .from("camp_needs")
        .update({
          quantity_fulfilled: newFulfilled,
          status: newStatus,
        })
        .eq("id", selectedNeed.id);

      await fetchData();
      setShowAssistDialog(false);
      setSelectedNeed(null);
      toast.success("Assistance pledged successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to provide assistance");
    }
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

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">NGO Dashboard</h1>
          <p className="text-muted-foreground">Coordinate relief operations</p>
        </div>
        <Button variant="outline" onClick={onSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <Tabs defaultValue="needs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="needs">Camp Needs</TabsTrigger>
          <TabsTrigger value="camps">All Camps</TabsTrigger>
        </TabsList>

        <TabsContent value="needs" className="space-y-4">
          {needs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No urgent needs at the moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {needs.map((need) => (
                <Card key={need.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{need.item_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {need.camps.name}
                        </p>
                      </div>
                      <Badge variant={urgencyColor(need.urgency) as any}>
                        {need.urgency}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{need.camps.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {need.quantity_fulfilled} / {need.quantity_needed}
                      </span>
                      <span className="text-muted-foreground">fulfilled</span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setSelectedNeed(need);
                        setShowAssistDialog(true);
                      }}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Provide Assistance
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="camps">
          <div className="grid md:grid-cols-3 gap-4">
            {camps.map((camp) => (
              <Card key={camp.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{camp.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{camp.location}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">
                      {camp.total_capacity - camp.occupied_seats} / {camp.total_capacity}
                    </span>
                    <span className="text-muted-foreground"> seats available</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAssistDialog} onOpenChange={setShowAssistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Assistance</DialogTitle>
          </DialogHeader>
          {selectedNeed && (
            <form onSubmit={handleProvideAssistance} className="space-y-4">
              <div>
                <Label>Item</Label>
                <Input value={selectedNeed.item_name} disabled />
              </div>
              <div>
                <Label>Camp</Label>
                <Input value={selectedNeed.camps.name} disabled />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity to Provide</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  max={selectedNeed.quantity_needed - selectedNeed.quantity_fulfilled}
                  min={1}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining needed: {selectedNeed.quantity_needed - selectedNeed.quantity_fulfilled}
                </p>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input id="notes" name="notes" placeholder="Delivery details, timeline, etc." />
              </div>
              <Button type="submit" className="w-full">
                Pledge Assistance
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NGODashboard;