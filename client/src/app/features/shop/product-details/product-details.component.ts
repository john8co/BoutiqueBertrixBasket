import { Component, inject, OnInit, signal } from '@angular/core';
import { ShopService } from '../../../core/services/shop.service';
import { ActivatedRoute } from '@angular/router';
import { Product } from '../../../shared/models/product';
import { CurrencyPipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel, MatSelect } from "@angular/material/select";
import { MatOption } from '@angular/material/core';
import { MatInput } from '@angular/material/input';
import { MatDivider } from "@angular/material/divider";
import { CartService } from '../../../core/services/cart.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-product-details',
  imports: [
    CurrencyPipe,
    MatButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatInput,
    MatDivider,
    FormsModule
],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss',
})
export class ProductDetailsComponent implements OnInit {  
  private shopService = inject(ShopService);
  private activatedRoute = inject(ActivatedRoute);
  private cartService = inject(CartService);
  product = signal<Product | undefined>(undefined);
  quantityInCart = signal(0);
  quantity = signal(1);
  selectedSize = signal<string | undefined>(undefined);

  ngOnInit(): void {
    this.loadProduct();
  }

  getButtonText() {
    return this.quantityInCart() > 0 ? 'Mettre à jour le panier' : 'Ajouter au panier'
  }

  onSizeChange(size: string) {
    this.selectedSize.set(size);
    this.updateQuantityInCart();
  }

  canUpdateCart() {
    if (this.hasSizes() && !this.selectedSize()) return false;
    return this.quantity() !== this.quantityInCart();
  }

  hasSizes() {
    return (this.product()?.sizes?.length ?? 0) > 0;
  }

  updateCart() {
    const product = this.product();
    if (!product) return;
    const qty = this.quantity();
    const qtyInCart = this.quantityInCart();
    const size = this.selectedSize();

    if (qty > qtyInCart) {
      const itemsToAdd = qty - qtyInCart;
      this.quantityInCart.set(qty);
      this.cartService.addItemToCart(product, itemsToAdd, size);
    } else {
      const itemsToRemove = qtyInCart - qty;
      this.quantityInCart.set(qty);
      this.cartService.removeItemFromCart(product.id, itemsToRemove, size);
    }
  }
  private loadProduct() {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (!id) return;
    this.shopService.getProduct(+id).subscribe({
      next: product => {
        this.product.set(product);
        this.updateQuantityInCart();
      },
      error: error => console.log(error)
    });
  }

  private updateQuantityInCart() {
    const qty = this.cartService.cart()?.items.find(x =>
      x.productId === this.product()?.id && x.size === this.selectedSize()
    )?.quantity || 0;
    this.quantityInCart.set(qty);
    this.quantity.set(qty || 1);
  }
}
