import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, MapPin, Users, Search, Heart } from "lucide-react";
import { toast } from "sonner";

interface Camp {
  id: string;
  name: string;
  location: string;
  total_capacity: number;
  occupied_seats: number;
  contact_phone: string;
  status: string;
}

interface UserDashboardProps {
  onSignOut: () => void;
}

const UserDashboard = ({ onSignOut }: UserDashboardProps) => {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCamps();
  }, []);

  const fetchCamps = async () => {
    try {
      const { data, error } = await supabase
        .from("camps")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCamps(data || []);
    } catch (error) {
      console.error("Error fetching camps:", error);
      toast.error("Failed to load camps");
    } finally {
      setLoading(false);
    }
  };

  const handleVolunteer = async (campId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("volunteers").insert({
        user_id: user.id,
        camp_id: campId,
        volunteer_type: "camp_volunteer",
        status: "active",
      });

      if (error) throw error;
      toast.success("Successfully registered as volunteer!");
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast.error("You're already registered for this camp");
      } else {
        toast.error("Failed to register as volunteer");
      }
    }
  };

  const filteredCamps = camps.filter(
    (camp) =>
      camp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      camp.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableSeats = (camp: Camp) => camp.total_capacity - camp.occupied_seats;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Relief Camps</h1>
          <p className="text-muted-foreground">Find nearby camps and volunteer</p>
        </div>
        <Button variant="outline" onClick={onSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by camp name or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading camps...</p>
        </div>
      ) : filteredCamps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No camps found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCamps.map((camp) => (
            <Card key={camp.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="flex-1">{camp.name}</span>
                  {availableSeats(camp) > 0 ? (
                    <Badge variant="outline" className="bg-success/10 text-success">
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Full</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">{camp.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {availableSeats(camp)} / {camp.total_capacity}
                  </span>
                  <span className="text-muted-foreground">seats available</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Contact: </span>
                  <span className="font-medium">{camp.contact_phone}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleVolunteer(camp.id)}
                  disabled={availableSeats(camp) === 0}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Register as Volunteer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;