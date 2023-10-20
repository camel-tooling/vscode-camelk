// camel-k: language=java

import org.apache.camel.builder.RouteBuilder;

public class SimpleProperty extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Write your routes here, for example:
        from("timer:java?period={{time:1000}}")
            .setBody()
                .simple("Hello Camel K with properties from {{firstProperty}} with extension - {{secondProperty}}")
            .log("${body}");
    }
}
