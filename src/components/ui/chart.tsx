import * as React from "react"
import { cn } from "@/lib/utils"

// Simple chart context for basic chart functionality
const ChartContext = React.createContext<{
  config?: Record<string, any>
}>({})

// Chart container component
const Chart = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config?: Record<string, any>
  }
>(({ className, config, ...props }, ref) => {
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        className={cn("", className)}
        {...props}
      />
    </ChartContext.Provider>
  )
})
Chart.displayName = "Chart"

// Chart tooltip component (simplified)
const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    active?: boolean
    payload?: any[]
    label?: string
    labelFormatter?: (value: any) => string
    formatter?: (value: any, name: string) => [string, string]
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
  }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      formatter,
      nameKey,
      labelKey,
      ...props
    },
    ref,
  ) => {
    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className,
        )}
        {...props}
      >
        {!hideLabel && label && (
          <div className="font-medium text-foreground">
            {labelFormatter ? labelFormatter(label) : label}
          </div>
        )}
        <div className="grid gap-1.5">
          {payload.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {!hideIndicator && (
                <div
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-[2px]",
                    indicator === "line" && "w-3 h-0.5",
                    indicator === "dashed" && "w-3 h-0.5 border-dashed border border-current"
                  )}
                  style={{ backgroundColor: item.color || "#8884d8" }}
                />
              )}
              <div className="flex flex-col">
                <span className="text-muted-foreground">
                  {item.name || item.dataKey}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {formatter ? formatter(item.value, item.name)[0] : item.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
)
ChartTooltip.displayName = "ChartTooltip"

// Chart legend component (simplified)
const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    payload?: any[]
    verticalAlign?: "top" | "bottom"
    hideIcon?: boolean
    nameKey?: string
  }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey, ...props }, ref) => {
  if (!payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
      {...props}
    >
      {payload.map((item, index) => {
        const key = `${nameKey || item.dataKey || "value"}-${index}`
        return (
          <div key={key} className="flex items-center gap-1.5 text-sm">
            {!hideIcon && (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color || "#8884d8" }}
              />
            )}
            <span className="text-muted-foreground">
              {item.value || item.name || item.dataKey}
            </span>
          </div>
        )
      })}
    </div>
  )
})
ChartLegend.displayName = "ChartLegend"

// Hook to use chart context
const useChart = () => {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a Chart component")
  }
  return context
}

// Simple chart container for custom implementations
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config?: Record<string, any>
  }
>(({ className, config, children, ...props }, ref) => {
  return (
    <Chart config={config}>
      <div
        ref={ref}
        className={cn("aspect-video w-full", className)}
        {...props}
      >
        {children}
      </div>
    </Chart>
  )
})
ChartContainer.displayName = "ChartContainer"

export {
  Chart,
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  useChart,
}