import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { ShieldWarning, Warning } from "phosphor-react-native";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { ResourceRowSkeleton } from "@/components/resource-row";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { CATEGORY_LABELS } from "@/constants/categories";
import { useThemeColor } from "@/hooks/use-theme-color";

/**
 * File de modération.
 *
 * Le contrôle de rôle fait ici ne sert qu'à l'affichage. La sécurité est dans
 * `convex/moderation.ts` : chaque query et mutation revérifie le rôle, donc
 * appeler la mutation directement ne mène nulle part.
 */
export default function ModQueueScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const user = useQuery(api.users.getCurrentAppUser);
  const isModerator = user?.role === "mod" || user?.role === "admin";

  const queue = useQuery(api.moderation.pending, isModerator ? {} : "skip");
  const approve = useMutation(api.moderation.approve);
  const reject = useMutation(api.moderation.reject);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (user === undefined) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader back title="Modération" />
        {Array.from({ length: 4 }, (_, i) => (
          <ResourceRowSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (!isModerator) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader back title="Modération" />
        <EmptyState
          icon={<ShieldWarning size={48} color={mutedForeground} weight="thin" />}
          title="ACCÈS RÉSERVÉ"
          description="Cet écran est réservé aux modérateurs."
        />
      </View>
    );
  }

  const handleApprove = async (id: Id<"resources">) => {
    setBusyId(id);
    try {
      await approve({ resourceId: id });
    } catch (e) {
      Alert.alert(
        "Approbation impossible",
        e instanceof Error ? e.message : "Réessayez.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: Id<"resources">) => {
    if (reason.trim().length === 0) return;
    setBusyId(id);
    try {
      await reject({ resourceId: id, reason: reason.trim() });
      setRejectingId(null);
      setReason("");
    } catch (e) {
      Alert.alert(
        "Rejet impossible",
        e instanceof Error ? e.message : "Réessayez.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        back
        title="Modération"
        action={{ label: "En attente", value: queue?.length ?? 0 }}
      />

      {queue === undefined ? (
        <View className="flex-1">
          {Array.from({ length: 4 }, (_, i) => (
            <ResourceRowSkeleton key={i} />
          ))}
        </View>
      ) : queue.length === 0 ? (
        <EmptyState
          title="FILE VIDE"
          description="Aucune ressource n'attend d'être examinée."
        />
      ) : (
        <ScrollView contentContainerClassName="gap-4 px-6 py-6 pb-32">
          {queue.map((item) => (
            <View
              key={item.id}
              className="gap-3 rounded-lg border border-border bg-card p-4"
            >
              {item.posterUrl ? (
                <Image
                  source={item.posterUrl}
                  style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 8 }}
                  contentFit="cover"
                />
              ) : null}

              <View className="gap-1">
                <Text className="font-sans-semibold text-base text-foreground">
                  {item.title}
                </Text>
                <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
                  {CATEGORY_LABELS[item.category]}
                  {item.sourceDomain ? ` · ${item.sourceDomain}` : ""}
                  {item.authorUsername ? ` · @${item.authorUsername}` : ""}
                </Text>
              </View>

              {item.description ? (
                <Text
                  className="font-sans text-sm leading-5 text-muted-foreground"
                  numberOfLines={3}
                >
                  {item.description}
                </Text>
              ) : null}

              {/* Les motifs de vigilance sont montrés tels quels : le
                  modérateur doit voir pourquoi l'entrée est remontée. */}
              {item.autoFlags.length > 0 || item.reportCount > 0 ? (
                <View className="flex-row flex-wrap items-center gap-2">
                  <Warning size={14} color="#FF7A71" weight="fill" />
                  {item.autoFlags.map((flag) => (
                    <Text
                      key={flag}
                      className="font-mono text-meta uppercase tracking-meta text-primary-ink"
                    >
                      {flag}
                    </Text>
                  ))}
                  {item.reportCount > 0 ? (
                    <Text className="font-mono text-meta uppercase tracking-meta text-primary-ink">
                      {item.reportCount} signalement
                      {item.reportCount > 1 ? "s" : ""}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {item.scanStatus && item.scanStatus !== "clean" ? (
                <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
                  Analyse : {item.scanStatus}
                </Text>
              ) : null}

              {rejectingId === item.id ? (
                <View className="gap-3">
                  <TextField
                    placeholder="Motif du rejet (envoyé à l'auteur)"
                    value={reason}
                    onChangeText={setReason}
                    autoFocus
                  />
                  <View className="flex-row gap-3">
                    <Button
                      label="Annuler"
                      variant="outline"
                      className="flex-1"
                      onPress={() => {
                        setRejectingId(null);
                        setReason("");
                      }}
                    />
                    <Button
                      label="Confirmer le rejet"
                      className="flex-1"
                      loading={busyId === item.id}
                      disabled={reason.trim().length === 0}
                      onPress={() => handleReject(item.id)}
                    />
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <Button
                    label="Rejeter"
                    variant="outline"
                    className="flex-1 border-destructive"
                    onPress={() => setRejectingId(item.id)}
                    disabled={busyId !== null}
                  />
                  <Button
                    label="Approuver"
                    className="flex-1"
                    loading={busyId === item.id}
                    disabled={busyId !== null}
                    onPress={() => handleApprove(item.id)}
                  />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
