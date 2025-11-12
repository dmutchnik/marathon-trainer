import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Marathon Trainer</CardTitle>
          <CardDescription>
            Plan smarter runs with a UI that adapts to your light or dark
            preference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Use the navigation to explore workouts, training plans, and progress
            tools tailored to your race goals. Toggle the theme anytime to match
            your environment.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
