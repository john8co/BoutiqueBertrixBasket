using API.DTOs;
using Core.Entities.OrderAggregate;

namespace API.Extensions;

public static class OrderMappingExtensions
{
    public static OrderDto ToDto(this Order order)
    {
        return new OrderDto
        {
            Id = order.Id,
            OrderDate = order.OrderDate,
            BuyerEmail = order.BuyerEmail,
            ShippingAddress = order.ShippingAddress,
            DeliveryMethod = order.DeliveryMethod.ShortName,
            ShippingPrice = order.DeliveryMethod.Price,
            PaymentSummary = order.PaymentSummary,
            OrderItems = order.OrderItems.Select(x => x.ToDto()).ToList(),
            Subtotal = order.Subtotal,
            Total = order.GetTotal(),
            Status = order.Status.ToFrenchString(),
            PaymentIntentId = order.PaymentIntentId
        };
    }

    private static string ToFrenchString(this OrderStatus status)
    {
        return status switch
        {
            OrderStatus.Pending => "En attente",
            OrderStatus.PaymentReceived => "Paiement reçu",
            OrderStatus.PaymentFailed => "Paiement échoué",
            OrderStatus.PaymentMismatch => "Incohérence de paiement",
            _ => status.ToString()
        };
    }

    public static OrderItemDto ToDto(this OrderItem item)
    {
        return new OrderItemDto
        {
            ProductId = item.ItemOrdered.ProductId,
            ProductName = item.ItemOrdered.ProductName,
            PictureUrl = item.ItemOrdered.PictureUrl,
            Price = item.Price,
            Quantity = item.Quantity
        };
    }
}