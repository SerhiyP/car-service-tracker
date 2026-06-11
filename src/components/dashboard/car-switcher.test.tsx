import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGarageStore } from "@/stores/garage";
import { CarSwitcher } from "./car-switcher";

const car = (id: string, name: string) => ({
  id,
  name,
  currentMileage: 10000,
  updatedAt: new Date().toISOString(),
});

afterEach(cleanup);

beforeEach(() => {
  useGarageStore.setState(useGarageStore.getInitialState());
});

describe("CarSwitcher", () => {
  it("renders a chip per car with aria-pressed on the selected one", () => {
    useGarageStore.setState({
      cars: [car("c1", "Honda Civic"), car("c2", "BMW E46")],
      selectedCarId: "c1",
    });
    render(<CarSwitcher />);
    expect(screen.getByRole("button", { name: "Honda Civic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "BMW E46" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selects a car on click", () => {
    useGarageStore.setState({
      cars: [car("c1", "Honda Civic"), car("c2", "BMW E46")],
      selectedCarId: "c1",
    });
    render(<CarSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "BMW E46" }));
    expect(useGarageStore.getState().selectedCarId).toBe("c2");
  });

  it("renders nothing with zero cars and a single chip with one car", () => {
    const { container } = render(<CarSwitcher />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    useGarageStore.setState({
      cars: [car("c1", "Honda Civic")],
      selectedCarId: "c1",
    });
    render(<CarSwitcher />);
    expect(
      screen.getByRole("button", { name: "Honda Civic" }),
    ).toBeInTheDocument();
  });
});
