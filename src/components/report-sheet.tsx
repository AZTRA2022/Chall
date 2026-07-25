import { useMutation } from "convex/react";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

const REASONS = [
  { id: "pirate", label: "Contenu piraté" },
  { id: "dangereux", label: "Dangereux ou malveillant" },
  { id: "trompeur", label: "Trompeur" },
  { id: "mort", label: "Lien mort" },
  { id: "hors-sujet", label: "Hors-sujet" },
] as const;

type Reason = (typeof REASONS)[number]["id"];

/**
 * Feuille de signalement (exigence Apple 1.2).
 *
 * Le motif est obligatoire et fermé : un champ libre seul produit des
 * signalements intriables, alors qu'un motif permet de prioriser la file.
 */
export function ReportSheet({
  resourceId,
  visible,
  onClose,
}: {
  resourceId: Id<"resources">;
  visible: boolean;
  onClose: () => void;
}) {
  const report = useMutation(api.social.report);
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await report({
        resourceId,
        reason,
        note: note.trim() || undefined,
      });
      setMessage(
        result.alreadyReported
          ? "Vous avez déjà signalé cette ressource."
          : "Signalement enregistré. Merci.",
      );
      // Laisse le temps de lire la confirmation avant de refermer.
      setTimeout(() => {
        onClose();
        setReason(null);
        setNote("");
        setMessage(null);
      }, 1200);
    } catch {
      setMessage("Le signalement n'a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60" onPress={onClose} />
      <View className="gap-5 rounded-t-xl border-t border-border bg-card px-6 pb-10 pt-6">
        <View className="gap-1">
          <Text className="font-display text-2xl text-foreground">
            SIGNALER
          </Text>
          <Text className="font-sans text-sm leading-5 text-muted-foreground">
            Un contenu signalé par plusieurs personnes est retiré du feed
            automatiquement, en attendant une revue.
          </Text>
        </View>

        <View className="gap-2">
          {REASONS.map((item) => {
            const active = reason === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setReason(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className={`rounded-md border px-4 py-3 ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary"
                }`}
              >
                <Text
                  className={`font-sans text-base ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          placeholder="Précision (facultative)"
          value={note}
          onChangeText={setNote}
        />

        {message ? (
          <Text className="font-sans text-sm text-primary-ink">{message}</Text>
        ) : null}

        <View className="flex-row gap-3">
          <Button
            label="Annuler"
            variant="outline"
            className="flex-1"
            onPress={onClose}
          />
          <Button
            label="Envoyer"
            className="flex-1"
            loading={busy}
            disabled={!reason || busy}
            onPress={submit}
          />
        </View>
      </View>
    </Modal>
  );
}
