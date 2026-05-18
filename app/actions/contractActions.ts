"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ContractStatus, type KioskStatus } from "@prisma/client"

// Types
type ContractFormData = {
  id?: string
  clientName: string
  clientIdNumber?: string
  clientIdIssuedDate?: string
  clientIdIssuedPlace?: string
  clientAddress?: string
  clientPhone?: string
  clientBusinessAddress?: string
  clientBusinessQuarter?: string
  clientBusinessLocation?: string
  contractDuration: number
  paymentFrequency: string
  paymentAmount: number
  kioskIds: string[]
  createdById?: string
}

// Create contract
export async function createContract(formData: ContractFormData) {
  try {
    // Validate form data
    if (!formData.clientName) {
      return { success: false, error: "Client name is required" }
    }

    if (!formData.contractDuration) {
      return { success: false, error: "Contract duration is required" }
    }

    if (!formData.paymentAmount) {
      return { success: false, error: "Payment amount is required" }
    }

    if (!formData.kioskIds || formData.kioskIds.length === 0) {
      return { success: false, error: "At least one kiosk must be selected" }
    }

    // Generate a unique contract number
    const contractNumber = `CONT-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // Calculate total amount
    const totalAmount = formData.paymentAmount * formData.contractDuration

    // Create the contract
    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        title: `Contrat de location de kiosque - ${formData.clientName}`,
        status: ContractStatus.DRAFT,
        clientName: formData.clientName,
        clientIdNumber: formData.clientIdNumber,
        clientIdIssuedDate: formData.clientIdIssuedDate ? new Date(formData.clientIdIssuedDate) : null,
        clientIdIssuedPlace: formData.clientIdIssuedPlace,
        clientAddress: formData.clientAddress,
        clientPhone: formData.clientPhone,
        clientBusinessAddress: formData.clientBusinessAddress,
        clientBusinessQuarter: formData.clientBusinessQuarter,
        clientBusinessLocation: formData.clientBusinessLocation,
        contractDuration: formData.contractDuration,
        paymentFrequency: formData.paymentFrequency,
        paymentAmount: parseFloat(formData.paymentAmount as any),
        totalAmount,
        createdById: formData.createdById!,
        kioskContracts: {
          create: formData.kioskIds.map((kioskId) => ({
            kioskId: parseInt(kioskId),
            monthlyRent: parseFloat(formData.paymentAmount as any),
            startDate: new Date(),
          })),
        },
        contractActions: {
          create: {
            action: "CONTRACT_CREATED",
            description: "Contract created in draft status",
          },
        },
      },
      include: {
        kioskContracts: {
          include: {
            kiosk: true,
          },
        },
      },
    })

    revalidatePath("/contracts")

    return {
      success: true,
      contract,
    }
  } catch (error) {
    console.error("Error creating contract:", error)
    return {
      success: false,
      error: "Failed to create contract",
    }
  }
}

// Update contract status
export async function updateContractStatus(contractId: string, status: ContractStatus, userId: string) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { 
        kioskContracts: {
          include: {
            kiosk: true,
          },
        },
      },
    })

    if (!contract) {
      return { success: false, error: "Contract not found" }
    }

    // Récupérer les IDs des kiosques
    const kioskIds = contract.kioskContracts.map(kc => kc.kioskId)

    let actionDescription = ""
    const additionalData: any = {}

    // Handle status-specific logic
    switch (status) {
      case ContractStatus.CONFIRMED:
        actionDescription = "Contract confirmed by admin"
        break

      case ContractStatus.ACTIVE:
        actionDescription = "Contract activated"
        additionalData.startDate = new Date()
        additionalData.signatureDate = new Date()
        additionalData.signedById = userId

        // Update kiosk status to ACTIVE
        await prisma.kiosk.updateMany({
          where: {
            id: {
              in: kioskIds,
            },
          },
          data: {
            status: "ACTIVE",
          },
        })

        // Update kiosk contracts to active
        await prisma.kioskContract.updateMany({
          where: {
            contractId: contractId,
          },
          data: {
            isActive: true,
          },
        })

        // Calculate end date based on contract duration
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + contract.contractDuration)
        additionalData.endDate = endDate
        break

      case ContractStatus.EXPIRED:
        actionDescription = "Contract expired"

        // Update kiosk status to AVAILABLE
        await prisma.kiosk.updateMany({
          where: {
            id: {
              in: kioskIds,
            },
          },
          data: {
            status: "AVAILABLE",
          },
        })

        // Update kiosk contracts to inactive
        await prisma.kioskContract.updateMany({
          where: {
            contractId: contractId,
          },
          data: {
            isActive: false,
          },
        })
        break

      case ContractStatus.TERMINATED:
        actionDescription = "Contract terminated"
        additionalData.terminationDate = new Date()

        // Update kiosk status to AVAILABLE
        await prisma.kiosk.updateMany({
          where: {
            id: {
              in: kioskIds,
            },
          },
          data: {
            status: "AVAILABLE",
          },
        })

        // Update kiosk contracts to inactive
        await prisma.kioskContract.updateMany({
          where: {
            contractId: contractId,
          },
          data: {
            isActive: false,
          },
        })
        break

      case ContractStatus.CANCELLED:
        actionDescription = "Contract cancelled"

        // Update kiosk status to AVAILABLE
        await prisma.kiosk.updateMany({
          where: {
            id: {
              in: kioskIds,
            },
          },
          data: {
            status: "AVAILABLE",
          },
        })

        // Update kiosk contracts to inactive
        await prisma.kioskContract.updateMany({
          where: {
            contractId: contractId,
          },
          data: {
            isActive: false,
          },
        })
        break

      default:
        actionDescription = `Contract status updated to ${status}`
    }

    // Update contract status
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status,
        ...additionalData,
        contractActions: {
          create: {
            action: `STATUS_${status}`,
            description: actionDescription,
          },
        },
      },
      include: {
        kioskContracts: {
          include: {
            kiosk: true,
          },
        },
        createdBy: true,
        signedBy: true,
        contractActions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    })

    revalidatePath("/contracts")
    revalidatePath(`/contracts/${contractId}`)

    return {
      success: true,
      contract: updatedContract,
    }
  } catch (error) {
    console.error("Error updating contract status:", error)
    return {
      success: false,
      error: "Failed to update contract status",
    }
  }
}

// Get a single contract by ID
export async function getContract(contractId: string) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        createdBy: true,
        signedBy: true,
        contractActions: {
          orderBy: {
            createdAt: "desc",
          },
        },
        kioskContracts: {
          include: {
            kiosk: true,
            compartment: true,
          },
        },
      },
    })

    if (!contract) {
      return { success: false, error: "Contract not found" }
    }

    // Transformer pour avoir un tableau de kiosks simple
    const formattedContract = {
      ...contract,
      kiosks: contract.kioskContracts.map(kc => kc.kiosk),
      compartments: contract.kioskContracts.map(kc => kc.compartment).filter(Boolean),
    }

    return {
      success: true,
      contract: formattedContract,
    }
  } catch (error) {
    console.error("Error fetching contract:", error)
    return {
      success: false,
      error: "Failed to fetch contract",
    }
  }
}

// Get all contracts for staff
export async function getAllContractsStaff(filters?: { status?: ContractStatus }) {
  try {
    const where: any = {}

    if (filters?.status) {
      where.status = filters.status
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        signedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contractActions: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
        kioskContracts: {
          include: {
            kiosk: {
              select: {
                id: true,
                kioskName: true,
                kioskMatricule: true,
                kioskType: true,
              }
            }
          }
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Transformer les données pour avoir un tableau de kiosks plus simple
    const formattedContracts = contracts.map(contract => ({
      ...contract,
      kiosks: contract.kioskContracts.map(kc => kc.kiosk)
    }))

    return {
      success: true,
      contracts: formattedContracts,
    }
  } catch (error) {
    console.error("Error fetching contracts:", error)
    return {
      success: false,
      error: "Failed to fetch contracts",
    }
  }
}

// Get all contracts (admin)
export async function getAllContracts(filters?: { status?: ContractStatus; userId?: string }) {
  try {
    const where: any = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.userId) {
      where.OR = [{ createdById: filters.userId }, { signedById: filters.userId }]
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        signedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contractActions: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
        kioskContracts: {
          include: {
            kiosk: {
              select: {
                id: true,
                kioskName: true,
                kioskMatricule: true,
                kioskType: true,
              }
            }
          }
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const formattedContracts = contracts.map(contract => ({
      ...contract,
      kiosks: contract.kioskContracts.map(kc => kc.kiosk)
    }))

    return {
      success: true,
      contracts: formattedContracts,
    }
  } catch (error) {
    console.error("Error fetching contracts:", error)
    return {
      success: false,
      error: "Failed to fetch contracts",
    }
  }
}

// Record a payment for a contract
export async function recordPayment(contractId: string, amount: number, paymentMethod: string, reference?: string) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    })

    if (!contract) {
      return { success: false, error: "Contract not found" }
    }

    const payment = await prisma.payment.create({
      data: {
        contractId,
        amount,
        paymentMethod,
        reference,
        paymentDate: new Date(),
        status: "COMPLETED",
      },
    })

    // Add contract action
    await prisma.contractAction.create({
      data: {
        contractId,
        action: "PAYMENT_RECORDED",
        description: `Payment of ${amount} FCFA recorded via ${paymentMethod}`,
      },
    })

    revalidatePath(`/contracts/${contractId}`)

    return {
      success: true,
      payment,
    }
  } catch (error) {
    console.error("Error recording payment:", error)
    return {
      success: false,
      error: "Failed to record payment",
    }
  }
}

// Get available kiosks
export async function getAvailableKiosks() {
  try {
    const kiosks = await prisma.kiosk.findMany({
      where: {
        status: "AVAILABLE",
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return {
      success: true,
      kiosks,
    }
  } catch (error) {
    console.error("Error fetching available kiosks:", error)
    return {
      success: false,
      error: "Failed to fetch available kiosks",
    }
  }
}

// Get kiosks without pagination
export async function getKiosksWithoutPagination({
  searchTerm = "",
  status,
}: {
  searchTerm?: string
  status?: KioskStatus | "all"
}) {
  try {
    const where: any = {}

    if (searchTerm) {
      where.OR = [
        { kioskName: { contains: searchTerm, mode: "insensitive" } },
        { clientName: { contains: searchTerm, mode: "insensitive" } },
        { managerName: { contains: searchTerm, mode: "insensitive" } },
        { kioskAddress: { contains: searchTerm, mode: "insensitive" } },
        { kioskMatricule: { contains: searchTerm, mode: "insensitive" } },
      ]
    }

    if (status && status !== "all") {
      where.status = status
    }

    const kiosks = await prisma.kiosk.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return {
      success: true,
      kiosks,
    }
  } catch (error) {
    console.error("Error fetching kiosks:", error)
    return {
      success: false,
      error: "Failed to fetch kiosks",
    }
  }
}

// Get users with search capability
export async function getUsers(searchTerm?: string, role: string = 'CLIENT') {
  try {
    const where: any = {
      role
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
      take: 50,
    })

    return {
      success: true,
      users,
    }
  } catch (error) {
    console.error("Error fetching users:", error)
    return {
      success: false,
      error: "Failed to fetch users",
    }
  }
}