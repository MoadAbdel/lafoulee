import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module.js";
import { PrivacyModule } from "../privacy/privacy.module.js";
import { InternalController } from "../notifications/internal.controller.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { OrderEventsPublisher } from "../notifications/order-events.publisher.js";
import { PaymentsController } from "../payments/payments.controller.js";
import { StripeGateway } from "../payments/stripe.gateway.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { StockService } from "./stock.service.js";

/** Commande, paiement et notifications : un seul module, car ces flux sont liés. */
@Module({
  imports: [CartModule, PrivacyModule],
  controllers: [OrdersController, PaymentsController, InternalController],
  providers: [OrdersService, StockService, StripeGateway, OrderEventsPublisher, NotificationsService],
  exports: [OrdersService, StripeGateway],
})
export class OrdersModule {}
