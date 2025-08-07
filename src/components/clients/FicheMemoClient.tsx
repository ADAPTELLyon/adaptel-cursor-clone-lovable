import { useEffect, useState } from "react";
import {
  BuildingStorefrontIcon,
  PhoneIcon,
  MapPinIcon,
  NoSymbolIcon,
  ClockIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  StarIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import dayjs from "dayjs";
import { Client } from "@/types/types-front";
import PlanningMiniClient from "@/components/Planning/PlanningMiniClient";
import { ClientEditDialog } from "@/components/clients/ClientEditDialog";


// Configuration des secteurs avec icônes
const secteursConfig = {
  "Étages": { 
    bg: "#d8b4fe",
    icon: <BuildingStorefrontIcon className="h-3 w-3" />
  },
  "Cuisine": { 
    bg: "#bfdbfe",
    icon: <BuildingStorefrontIcon className="h-3 w-3" />
  },
  "Salle": { 
    bg: "#fcd5b5",
    icon: <BuildingStorefrontIcon className="h-3 w-3" />
  },
  "Plonge": { 
    bg: "#e5e7eb",
    icon: <BuildingStorefrontIcon className="h-3 w-3" />
  },
  "Réception": { 
    bg: "#fef9c3",
    icon: <BuildingStorefrontIcon className="h-3 w-3" />
  }
};

// Couleurs des statuts
const statutColors = {
  "Validé": { bg: "#a9d08e", text: "#000000" },
  "Annulé Client": { bg: "#fef3c7", text: "#1f2937" },
  "Absence": { bg: "#f87171", text: "white" }
};

interface FicheMemoClientProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onOpenClientEdit?: (clientId: string) => void;
}

export default function FicheMemoClient({
  open,
  onOpenChange,
  clientId,
  onOpenClientEdit,
}: FicheMemoClientProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [interdictions, setInterdictions] = useState<any[]>([]);
  const [priorites, setPriorites] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingComment, setEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState("");

  const [nbValide, setNbValide] = useState(0);
  const [nbAnnuleClient, setNbAnnuleClient] = useState(0);
  const [nbAbsence, setNbAbsence] = useState(0);

  useEffect(() => {
    if (!open || !clientId) return;
    const fetchData = async () => {
      const { data: cli } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      setClient(cli);
      setCommentValue(cli?.commentaire || "");

      const { data: contactList } = await supabase
        .from("contacts_clients")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      setContacts(contactList || []);

      const { data: inter } = await supabase
        .from("interdictions_priorites")
        .select("*, candidat:candidat_id(nom,prenom), user:created_by(prenom)")
        .eq("client_id", clientId)
        .eq("type", "interdiction");
      setInterdictions(inter?.sort((a,b) => a.candidat.nom.localeCompare(b.candidat.nom)) || []);

      const { data: prior } = await supabase
        .from("interdictions_priorites")
        .select("*, candidat:candidat_id(nom,prenom), user:created_by(prenom)")
        .eq("client_id", clientId)
        .eq("type", "priorite");
      setPriorites(prior?.sort((a,b) => a.candidat.nom.localeCompare(b.candidat.nom)) || []);

      const { data: incid } = await supabase
        .from("incidents")
        .select("id, type_incident, description, date_incident, candidat:candidat_id(nom,prenom), user:created_by(prenom), client_id, created_at")
        .eq("client_id", clientId);
      setIncidents(incid?.sort((a,b) => a.candidat.nom.localeCompare(b.candidat.nom)) || []);

      const { count: countValide } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("statut", "Validé");
      setNbValide(countValide || 0);

      const { count: countAnnule } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("statut", "Annule Client");
      setNbAnnuleClient(countAnnule || 0);

      const { count: countAbsence } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("statut", "Absence");
      setNbAbsence(countAbsence || 0);
    };
    fetchData();
  }, [open, clientId]);

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  const handleSaveComment = async () => {
    if (!clientId) return;
    const { error } = await supabase
      .from("clients")
      .update({ commentaire: commentValue })
      .eq("id", clientId);
    
    if (!error) {
      setEditingComment(false);
      setClient(prev => prev ? {...prev, commentaire: commentValue} : null);
    }
  };

  const renderSecteurBadge = (secteur: string) => {
    const config = secteursConfig[secteur as keyof typeof secteursConfig] || {
      bg: "#e5e7eb",
      icon: <BuildingStorefrontIcon className="h-3 w-3" />
    };
    
    return (
      <span 
        className="inline-flex items-center text-xs px-2 py-1 rounded-full ml-2"
        style={{ backgroundColor: config.bg }}
      >
        {config.icon}
        <span className="ml-1">{secteur}</span>
      </span>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[85vw] w-full max-h-[90vh] h-full p-0 rounded-lg overflow-hidden shadow-xl flex flex-col">
          {/* Header avec une seule croix */}
          <div className="bg-white px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gray-100 p-2 rounded-lg">
                <BuildingStorefrontIcon className="h-8 w-8 text-[#840404]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{client?.nom}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <span className="flex items-center">
                    <PhoneIcon className="h-4 w-4 mr-1 text-gray-500" />
                    {client?.telephone || "Non renseigné"}
                  </span>
                  <span className="flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1 text-gray-500" />
                    {client?.code_postal} {client?.ville || "-"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center  mr-8">
            <button 
  onClick={() => {
    onOpenChange(false)
    setTimeout(() => {
      onOpenClientEdit?.(clientId)
    }, 400)
  }}
  className="flex items-center space-x-2 bg-[#840404] hover:bg-[#a50505] text-white px-4 py-2 rounded-lg text-sm font-medium transition"
>
  <PencilSquareIcon className="h-4 w-4" />
  <span>Voir fiche complète</span>
</button>

</div>
          </div>

          {/* Main Content - Partie haute (60%) */}
          <div className="grid grid-cols-12 gap-3 bg-gray-50 p-3" style={{ height: '60%' }}>
            {/* Colonne de gauche */}
            <div className="col-span-12 md:col-span-3 space-y-3 h-full flex flex-col">
              <Card title="Informations" icon={<UserCircleIcon className="h-4 w-4 text-gray-600" />}>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  <InfoItem icon={<ClockIcon className="h-4 w-4 text-gray-500" />} label="Créé le"
                    value={client?.created_at ? dayjs(client.created_at).format("DD/MM/YYYY") : "-"} />
                  <InfoItem icon={<CheckCircleIcon className="h-4 w-4 text-gray-500" />} label="Statut"
                    value={client?.actif ? "Actif" : "Inactif"} 
                    valueColor={client?.actif ? "text-green-600" : "text-red-600"} />
                  <InfoItem icon={<BuildingStorefrontIcon className="h-4 w-4 text-gray-500" />} label="Secteur"
                    value={
                      client?.secteurs?.length ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {client.secteurs.map(secteur => renderSecteurBadge(secteur))}
                        </div>
                      ) : "-"
                    } />
                  
                  <div className="space-y-2 pt-2">
                    <div className="text-sm font-medium text-gray-700 flex items-center">
                      <UserCircleIcon className="h-4 w-4 mr-2 text-gray-500" />
                      Contact
                    </div>
                    <select
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#840404] focus:border-[#840404]"
                      value={selectedContactId || ""}
                      onChange={(e) => setSelectedContactId(e.target.value || null)}
                    >
                      <option value="">-- Aucun --</option>
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nom} {c.prénom}
                        </option>
                      ))}
                    </select>
                    {selectedContact && (
                      <div className="text-sm text-gray-600 mt-2 space-y-1 bg-gray-50 p-2 rounded">
                        <div><span className="font-medium">Fonction :</span> {selectedContact.fonction || "-"}</div>
                        <div><span className="font-medium">Téléphone :</span> {selectedContact.telephone || "-"}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card title="Missions" icon={<CheckCircleIcon className="h-4 w-4 text-gray-600" />}>
                <div className="space-y-2 flex-1 flex flex-col justify-between">
                  <IndicateurCard 
                    label="Validées" 
                    value={nbValide} 
                    icon={<CheckCircleIcon className="h-4 w-4" style={{ color: statutColors["Validé"].text }} />}
                    bgColor={statutColors["Validé"].bg}
                    textColor={statutColors["Validé"].text}
                  />
                  <IndicateurCard 
                    label="Annulé Client" 
                    value={nbAnnuleClient} 
                    icon={<NoSymbolIcon className="h-4 w-4" style={{ color: statutColors["Annulé Client"].text }} />}
                    bgColor={statutColors["Annulé Client"].bg}
                    textColor={statutColors["Annulé Client"].text}
                  />
                  <IndicateurCard 
                    label="Absence" 
                    value={nbAbsence} 
                    icon={<ExclamationTriangleIcon className="h-4 w-4" style={{ color: statutColors["Absence"].text }} />}
                    bgColor={statutColors["Absence"].bg}
                    textColor={statutColors["Absence"].text}
                  />
                </div>
              </Card>
            </div>

            {/* Colonne du milieu */}
            <div className="col-span-12 md:col-span-5 space-y-3 h-full flex flex-col">
              <Card 
                title="Interdictions" 
                icon={<NoSymbolIcon className="h-4 w-4 text-gray-600" />}
                badge={<Badge variant="destructive">{interdictions.length}</Badge>}
              >
                 <div className="flex-1 overflow-y-auto max-h-[260px] pr-1">
                  {interdictions.length > 0 ? interdictions.map(item => (
                    <ListItem 
                      key={item.id}
                      icon={<NoSymbolIcon className="h-4 w-4 text-red-500" />}
                      title={
                        <div className="flex items-center">
                          {`${item.candidat?.prenom} ${item.candidat?.nom}`}
                          {renderSecteurBadge(item.secteur)}
                        </div>
                      }
                      subtitle={item.commentaire || "-"}
                      desc={item.commentaire || "-"}
                      date={dayjs(item.created_at).format("DD/MM/YYYY")}
                      user={item.user?.prenom}
                    />
                  )) : (
                    <EmptyState message="Aucune interdiction enregistrée" />
                  )}
                </div>
              </Card>

              <Card 
                title="Incidents" 
                icon={<ExclamationTriangleIcon className="h-4 w-4 text-gray-600" />}
                badge={<Badge className="bg-amber-100 text-amber-800">{incidents.length}</Badge>}
              >
               <div className="flex-1 overflow-y-auto max-h-[260px] pr-1">
                  {incidents.length > 0 ? incidents.map(item => (
                    <ListItem 
                      key={item.id}
                      icon={<ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />}
                      title={`${item.candidat?.prenom} ${item.candidat?.nom}`}
                      subtitle={item.type_incident}
                      desc={item.description || "-"}
                      date={dayjs(item.date_incident).format("DD/MM/YYYY")}
                      user={item.user?.prenom}
                    />
                  )) : (
                    <EmptyState message="Aucun incident enregistré" />
                  )}
                </div>
              </Card>
            </div>

            {/* Colonne de droite */}
            <div className="col-span-12 md:col-span-4 space-y-3 h-full flex flex-col">
              <Card 
                title="Priorités" 
                icon={<StarIcon className="h-4 w-4 text-gray-600" />}
                badge={<Badge className="bg-green-100 text-green-800">{priorites.length}</Badge>}
              >
           <div className="flex-1 overflow-y-auto max-h-[260px] pr-1">
                  {priorites.length > 0 ? priorites.map(item => (
                    <ListItem 
                      key={item.id}
                      icon={<StarIcon className="h-4 w-4 text-yellow-500" />}
                      title={
                        <div className="flex items-center">
                          {`${item.candidat?.prenom} ${item.candidat?.nom}`}
                          {renderSecteurBadge(item.secteur)}
                        </div>
                      }
                      subtitle={item.commentaire || "-"}
                      desc={item.commentaire || "-"}
                      date={dayjs(item.created_at).format("DD/MM/YYYY")}
                      user={item.user?.prenom}
                    />
                  )) : (
                    <EmptyState message="Aucune priorité enregistrée" />
                  )}
                </div>
              </Card>

              <Card title="Commentaire" icon={<PencilSquareIcon className="h-4 w-4 text-gray-600" />}>
                <div className="flex-1 flex flex-col">
                  {editingComment ? (
                    <div className="flex flex-col h-full">
                      <textarea
                        className="flex-1 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-300"
                        value={commentValue}
                        onChange={(e) => setCommentValue(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end space-x-2 mt-2">
                        <button 
                          onClick={() => setEditingComment(false)}
                          className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Annuler
                        </button>
                        <button 
                          onClick={handleSaveComment}
                          className="px-3 py-1 text-sm text-white bg-[#840404] rounded hover:bg-[#a50505]"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="flex-1 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => setEditingComment(true)}
                    >
                      {commentValue || (
                        <p className="text-gray-400 italic">Cliquez pour ajouter un commentaire...</p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Planning Section - Partie basse (40%) */}
          <div className="bg-white border-t px-4 py-3" style={{ height: '40%', minHeight: '200px' }}>
            <div className="h-full overflow-y-auto">
              <PlanningMiniClient clientId={clientId} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {clientId && (
  <ClientEditDialog
    key={clientId}
    clientId={clientId}
    open={showEditDialog}
    onOpenChange={setShowEditDialog}
  />
      )}
    </>
  );
}

function Card({ title, children, icon, badge }: { 
  title: string; 
  children: React.ReactNode; 
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-white border rounded-lg shadow-sm h-full flex flex-col">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="p-3 flex-1 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}

function InfoItem({ icon, label, value, valueColor = "text-gray-800" }: { 
  icon: React.ReactNode; 
  label: string; 
  value: React.ReactNode; 
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center text-gray-600">
        {icon}
        <span className="ml-2">{label}</span>
      </div>
      <span className={`font-medium ${valueColor}`}>{value}</span>
    </div>
  );
}

function ListItem({ icon, title, subtitle, desc, date, user }: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  desc: string;
  date?: string;
  user?: string;
}) {
  const showDesc = desc && subtitle !== desc;

  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 mb-2 shadow-sm">
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-2">
          {icon && <div className="mt-1">{icon}</div>}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-gray-700 mt-1 font-medium">{subtitle}</div>
            )}
            {showDesc && (
              <div className="text-xs text-gray-600 mt-1">{desc}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end text-xs text-gray-500 ml-4">
          {date && <span>{date}</span>}
          {user && <span className="text-gray-400 italic">par {user}</span>}
        </div>
      </div>
    </div>
  );
}


function IndicateurCard({ label, value, icon, bgColor, textColor }: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}) {
  return (
    <div 
      className="p-3 rounded-lg flex items-center justify-between"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="flex items-center space-x-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-gray-400 py-4">
      <div className="text-sm italic">{message}</div>
    </div>
  );
}