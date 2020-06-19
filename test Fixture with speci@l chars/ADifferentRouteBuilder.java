import org.apache.camel.builder.RouteBuilder;

public class ADifferentRouteBuilder extends RouteBuilder {

    public void configure() {
        from("timer:timerName?delay=1000");
    }

}