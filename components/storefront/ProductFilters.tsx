"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

export function ProductFilters() {
  const [priceRange, setPriceRange] = useState([0, 1000])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const categories = ["Electronics", "Clothing", "Home & Garden", "Sports", "Books", "Toys"]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Price Range */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Price Range</Label>
            <Slider value={priceRange} onValueChange={setPriceRange} max={1000} step={10} className="mb-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>${priceRange[0]}</span>
              <span>${priceRange[1]}</span>
            </div>
          </div>

          {/* Categories */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Categories</Label>
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={category}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCategories([...selectedCategories, category])
                      } else {
                        setSelectedCategories(selectedCategories.filter((c) => c !== category))
                      }
                    }}
                  />
                  <Label htmlFor={category} className="text-sm">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Apply Filters */}
          <Button className="w-full">Apply Filters</Button>
        </CardContent>
      </Card>
    </div>
  )
}
