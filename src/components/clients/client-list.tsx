import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { secteursList } from "@/lib/secteurs";
import { Separator } from "@/components/ui/separator";

const normalize = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const secteursMap = secteursList.reduce((acc, s) => {
  const key = normalize(s.value);
  acc[key] = s;
  return acc;
}, {} as Record<string, { value: string; label: string; icon: React.ComponentType<{ className?: string }> }>);

const secteurOrder = secteursList.map((s) => normalize(s.value));

type Client = {
  id: string;
  nom: string;
  secteurs?: string[];
  services?: string[];
  actif: boolean;
};

type ClientListProps = {
  clients: Client[];
  onEdit: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
};

export function ClientList({ clients, onEdit, onToggleActive }: ClientListProps) {
  const clientsBySecteur = clients.reduce((acc, client) => {
    const premierSecteur = client.secteurs?.[0];
    if (!premierSecteur) return acc;
    const key = normalize(premierSecteur);
    if (!acc[key]) acc[key] = [];
    acc[key].push(client);
    return acc;
  }, {} as Record<string, Client[]>);

  for (const key in clientsBySecteur) {
    clientsBySecteur[key].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }

  return (
    <div className="space-y-8 p-2">
      {secteurOrder.map((secteurKey) => {
        const clientsDuSecteur = clientsBySecteur[secteurKey] || [];
        if (clientsDuSecteur.length === 0) return null;

        const secteur = secteursMap[secteurKey];
        const Icon = secteur.icon;

        return (
          <div key={secteurKey} className="space-y-4">
            {/* Secteur Header */}
            <div className="flex items-center justify-between bg-[#840404] text-white px-6 py-3 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 text-lg font-semibold">
                <Icon className="w-5 h-5" />
                <span>{secteur.label}</span>
              </div>
              <Badge variant="secondary" className="bg-white text-[#840404] font-medium">
                {clientsDuSecteur.length} {clientsDuSecteur.length > 1 ? "clients" : "client"}
              </Badge>
            </div>

            {/* Client Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {clientsDuSecteur.map((client) => (
                <Card 
                  key={client.id} 
                  className="h-full flex flex-col border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-[#840404]/30"
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        {client.nom}
                      </CardTitle>
                      {client.actif ? (
                        <Badge className="bg-[#a9d08e] text-[#2d572c] font-medium">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-300 text-red-500 bg-white">
                          Inactif
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 space-y-3">
                    {/* Secteurs */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Secteurs
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {client.secteurs && client.secteurs.length > 0 ? (
                          client.secteurs.map((secteur) => {
                            const key = normalize(secteur);
                            const s = secteursMap[key];
                            const SIcon = s?.icon;
                            return (
                              <Badge 
                                key={secteur} 
                                variant="outline" 
                                className="flex items-center gap-1 text-xs bg-gray-50"
                              >
                                {SIcon && <SIcon className="h-3 w-3" />}
                                {s?.label || secteur}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-sm text-gray-400">Aucun secteur</span>
                        )}
                      </div>
                    </div>

                    <Separator className="my-2" />

                    {/* Services */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Services
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {client.services && client.services.length > 0 ? (
                          client.services.map((srv) => (
                            <Badge 
                              key={srv} 
                              variant="secondary" 
                              className="text-xs bg-gray-100 text-gray-800"
                            >
                              {srv}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">Aucun service</span>
                        )}
                      </div>
                    </div>
                  </CardContent>

                  {/* Card Footer with Edit Button */}
                  <CardFooter className="pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(client.id)}
                      className="w-full gap-2 border-[#840404] text-[#840404] hover:bg-[#840404]/10 hover:text-[#840404]"
                    >
                      <Edit className="h-4 w-4" />
                      Modifier
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}