import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { secteursList } from "@/lib/secteurs";
import type { PosteType } from "@/types/types-front";

interface CommandeFormGaucheProps {
  secteur: string;
  setSecteur: (s: string) => void;
  clientId: string;
  setClientId: (s: string) => void;
  service: string;
  setService: (s: string) => void;
  semaine: string;
  setSemaine: (s: string) => void;
  motif: string;
  setMotif: (s: string) => void;
  commentaire: string;
  setCommentaire: (s: string) => void;
  clients: { id: string; nom: string; services?: string[] }[];
  services: string[];
  semainesDisponibles: { value: string; label: string }[];
  posteTypeId: string;
  setPosteTypeId: (s: string) => void;
  postesTypes: PosteType[];
  setHeuresParJour: (val: any) => void;
  setJoursState: (val: any) => void;
}

export default function CommandeFormGauche({
  secteur,
  setSecteur,
  clientId,
  setClientId,
  service,
  setService,
  semaine,
  setSemaine,
  motif,
  setMotif,
  commentaire,
  setCommentaire,
  clients,
  services,
  semainesDisponibles,
  posteTypeId,
  setPosteTypeId,
  postesTypes,
  setHeuresParJour,
  setJoursState,
}: CommandeFormGaucheProps) {
  return (
    <div className="space-y-6 border p-4 rounded-lg shadow-md bg-white">
      {/* Secteurs */}
      <div className="space-y-2">
        <div className="font-semibold text-sm">Secteur</div>
        <div className="grid grid-cols-5 gap-2">
          {secteursList.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant={secteur === label ? "default" : "outline"}
              className="flex items-center justify-center gap-1 text-xs py-2"
              onClick={() => {
                setSecteur(label);
                setClientId("");
                setService("");
                setPosteTypeId("");
                setHeuresParJour({});
                setJoursState({});
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Client */}
      <div className="space-y-2">
        <div className="font-semibold text-sm">Client</div>
        <select
          className="border rounded w-full px-2 py-2 text-sm"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setService("");
            setPosteTypeId("");
            setHeuresParJour({});
            setJoursState({});
          }}
        >
          <option value="">Sélectionner un client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Service */}
      <div className="space-y-2">
        <div className="font-semibold text-sm">Service</div>
        <select
          className={`border rounded w-full px-2 py-2 text-sm ${
            services.length === 0
              ? "opacity-50 cursor-not-allowed bg-gray-100"
              : ""
          }`}
          value={service}
          onChange={(e) => setService(e.target.value)}
          disabled={services.length === 0}
        >
          <option value="">
            {services.length === 0
              ? "Aucun service disponible"
              : "Sélectionner un service"}
          </option>
          {services.map((svc) => (
            <option key={svc} value={svc}>
              {svc}
            </option>
          ))}
        </select>
      </div>

      {/* Semaine */}
      <div className="space-y-2">
        <div className="font-semibold text-sm">Semaine</div>
        <select
          className="border rounded w-full px-2 py-2 text-sm"
          value={semaine}
          onChange={(e) => setSemaine(e.target.value)}
        >
          {semainesDisponibles.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Motif */}
      <div className="space-y-2">
        <div className="font-semibold text-sm">Motif contrat</div>
        <select
          className="border rounded w-full px-2 py-2 text-sm"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        >
          <option>Extra Usage constant</option>
          <option>Accroissement d’activité</option>
          <option>Remplacement de personnel</option>
        </select>
        {(motif === "Accroissement d’activité" ||
          motif === "Remplacement de personnel") && (
          <Input
            placeholder="Précisez le motif"
            className="mt-2"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        )}
      </div>

      {/* Info */}
      <div className="space-y-2">
        <div className="font-semibold text-sm">Information</div>
        <Textarea
          placeholder="Informations complémentaires..."
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
        />
      </div>

      {/* Poste type */}
      <div className="space-y-2">
        <div className="font-semibold text-sm">Poste type</div>
        <select
          className="border rounded w-full px-2 py-2 text-sm"
          value={posteTypeId}
          onChange={(e) => setPosteTypeId(e.target.value)}
          disabled={!postesTypes || postesTypes.length === 0}
        >
          <option value="">
            {postesTypes.length === 0
              ? "Aucun poste type disponible"
              : "Sélectionner un poste type"}
          </option>
          {postesTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.nom}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
