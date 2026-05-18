"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeftIcon, FileIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon } from "lucide-react"
import { getContract, updateContractStatus } from "@/app/actions/contractActions"
import type { ContractStatus } from "@prisma/client"

export default function ContractDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const contractId = params.id as string

  const [contract, setContract] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  useEffect(() => {
    const fetchContract = async () => {
      setIsLoading(true)
      try {
        const result = await getContract(contractId)
        if (result.success) {
          setContract(result.contract)
        } else {
          setError(result.error || "Failed to load contract")
        }
      } catch (error) {
        console.error("Error fetching contract:", error)
        setError("An error occurred while loading the contract")
      } finally {
        setIsLoading(false)
      }
    }

    if (contractId && session) {
      fetchContract()
    }
  }, [contractId, session])

  const handleStatusUpdate = async (newStatus: ContractStatus) => {
    if (!session?.user?.id) return
    
    setIsUpdating(true)
    try {
      const result = await updateContractStatus(contractId, newStatus, session.user.id)
      if (result.success) {
        setContract(result.contract)
      } else {
        setError(result.error || "Failed to update contract status")
      }
    } catch (error) {
      console.error("Error updating contract status:", error)
      setError("An error occurred while updating the contract")
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Brouillon</Badge>
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
      case "CONFIRMED":
        return <Badge className="bg-blue-100 text-blue-800">Confirmé</Badge>
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800">Actif</Badge>
      case "EXPIRED":
        return <Badge className="bg-red-100 text-red-800">Expiré</Badge>
      case "TERMINATED":
        return <Badge className="bg-red-100 text-red-800">Résilié</Badge>
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-800">Annulé</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusActions = (status: ContractStatus) => {
    switch (status) {
      case "DRAFT":
        return (
          <div className="flex gap-2">
            <Button onClick={() => handleStatusUpdate("CONFIRMED")} disabled={isUpdating}>
              Confirmer
            </Button>
            <Button variant="destructive" onClick={() => handleStatusUpdate("CANCELLED")} disabled={isUpdating}>
              Annuler
            </Button>
          </div>
        )
      case "CONFIRMED":
        return (
          <div className="flex gap-2">
            <Button onClick={() => handleStatusUpdate("ACTIVE")} disabled={isUpdating}>
              Activer
            </Button>
            <Button variant="destructive" onClick={() => handleStatusUpdate("CANCELLED")} disabled={isUpdating}>
              Annuler
            </Button>
          </div>
        )
      case "ACTIVE":
        return (
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => handleStatusUpdate("TERMINATED")} disabled={isUpdating}>
              Résilier
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircleIcon className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-500">{error || "Contract not found"}</p>
        <Button onClick={() => router.push("/admin/contrat")} className="mt-4">
          Retour à la liste
        </Button>
      </div>
    )
  }

  // Récupérer la liste des kiosques en toute sécurité
  const kiosksList = contract.kiosks || []
  const kiosksCount = kiosksList.length

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/admin/contrat")}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">{contract.contractNumber}</h1>
          {getStatusBadge(contract.status)}
        </div>
        {getStatusActions(contract.status)}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="kiosks">Kiosques ({kiosksCount})</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du contrat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="font-medium">{contract.clientName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Téléphone</p>
                  <p className="font-medium">{contract.clientPhone || "Non renseigné"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Adresse</p>
                  <p className="font-medium">{contract.clientAddress || "Non renseignée"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Durée</p>
                  <p className="font-medium">{contract.contractDuration} mois</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fréquence de paiement</p>
                  <p className="font-medium">{contract.paymentFrequency}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Montant mensuel</p>
                  <p className="font-medium">{Number(contract.paymentAmount).toLocaleString()} FCFA</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Montant total</p>
                  <p className="font-medium">{Number(contract.totalAmount).toLocaleString()} FCFA</p>
                </div>
                {contract.startDate && (
                  <div>
                    <p className="text-sm text-gray-500">Date de début</p>
                    <p className="font-medium">{new Date(contract.startDate).toLocaleDateString("fr-FR")}</p>
                  </div>
                )}
                {contract.endDate && (
                  <div>
                    <p className="text-sm text-gray-500">Date de fin</p>
                    <p className="font-medium">{new Date(contract.endDate).toLocaleDateString("fr-FR")}</p>
                  </div>
                )}
              </div>
              {contract.contractDocument && (
                <div className="pt-4">
                  <Button variant="outline" onClick={() => window.open(contract.contractDocument, "_blank")}>
                    <FileIcon className="h-4 w-4 mr-2" />
                    Télécharger le contrat
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations professionnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Adresse professionnelle</p>
                  <p className="font-medium">{contract.clientBusinessAddress || "Non renseignée"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Quartier</p>
                  <p className="font-medium">{contract.clientBusinessQuarter || "Non renseigné"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Localisation</p>
                  <p className="font-medium">{contract.clientBusinessLocation || "Non renseignée"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kiosks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Kiosques associés</CardTitle>
            </CardHeader>
            <CardContent>
              {kiosksCount === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun kiosque associé à ce contrat</p>
              ) : (
                <div className="space-y-2">
                  {kiosksList.map((kiosk: any) => (
                    <div key={kiosk.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{kiosk.kioskName || kiosk.kioskMatricule}</p>
                        <p className="text-sm text-gray-500">Type: {kiosk.kioskType === "MONO" ? "MONO (1 compartiment)" : "GRAND (3 compartiments)"}</p>
                      </div>
                      <Badge variant="outline">Assigné</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Historique des actions</CardTitle>
            </CardHeader>
            <CardContent>
              {contract.contractActions && contract.contractActions.length > 0 ? (
                <div className="space-y-4">
                  {contract.contractActions.map((action: any) => (
                    <div key={action.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="w-2 h-2 mt-2 rounded-full bg-orange-500" />
                      <div>
                        <p className="font-medium">{action.action}</p>
                        <p className="text-sm text-gray-500">{action.description}</p>
                        <p className="text-xs text-gray-400">{new Date(action.createdAt).toLocaleString("fr-FR")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Aucun historique disponible</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}